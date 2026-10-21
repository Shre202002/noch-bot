import Groq from "groq-sdk";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "groq-sdk/resources/chat/completions";

/**
 * Groq chat model used by the website and PDF chat routes.
 * Override with GROQ_MODEL when Groq retires or renames a model.
 */
export const GROQ_CHAT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** Shown to visitors when every configured Groq key is exhausted or failing. */
export const GROQ_UNAVAILABLE_REPLY =
  "I'm unable to answer right now. Please contact the website owner directly for help.";

export class GroqUnavailableError extends Error {
  constructor() {
    super("All Groq API keys are exhausted or unavailable");
    this.name = "GroqUnavailableError";
  }
}

const SERVER_ERROR_COOLDOWN_MS = 60_000;
const AUTH_ERROR_COOLDOWN_MS = 60 * 60_000;

/**
 * Reads GROQ_API_KEY_1, GROQ_API_KEY_2, ... until a number is missing.
 * Falls back to the legacy single GROQ_API_KEY.
 */
export function getGroqKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; process.env[`GROQ_API_KEY_${i}`] !== undefined; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`]!.trim();
    if (key) keys.push(key);
  }
  if (keys.length === 0 && process.env.GROQ_API_KEY?.trim()) {
    keys.push(process.env.GROQ_API_KEY.trim());
  }
  return keys;
}

// Rotation state is per server instance. The active key stays sticky so we
// don't hit an exhausted key 1 on every request; cooled-down keys are skipped.
let activeIndex = 0;
const cooldownUntil = new Map<number, number>();

/** Returns a cooldown in ms when the error means "try the next key", else null. */
function switchCooldownMs(err: unknown): number | null {
  if (err instanceof Groq.APIConnectionError) return SERVER_ERROR_COOLDOWN_MS;
  if (!(err instanceof Groq.APIError) || err.status === undefined) return null;

  if (err.status === 429) {
    const retryAfter = Number(err.headers?.get("retry-after"));
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : SERVER_ERROR_COOLDOWN_MS;
  }
  if (err.status === 401 || err.status === 403) return AUTH_ERROR_COOLDOWN_MS;
  if (err.status >= 500) return SERVER_ERROR_COOLDOWN_MS;
  // 400/404 etc. are request bugs (bad params, unknown model) that every key would hit.
  return null;
}

type GroqChatParams = Omit<ChatCompletionCreateParamsNonStreaming, "model"> & {
  model?: string;
};

/**
 * Chat completion that rotates through the configured Groq keys
 * (1 → 2 → ... → N → 1) on quota, auth, and server errors.
 * Throws GroqUnavailableError when no key can serve the request.
 */
export async function groqChat(params: GroqChatParams): Promise<ChatCompletion> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    console.error("[groq] no API keys configured (GROQ_API_KEY_1..N)");
    throw new GroqUnavailableError();
  }

  const start = activeIndex % keys.length;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const index = (start + attempt) % keys.length;
    if ((cooldownUntil.get(index) ?? 0) > Date.now()) continue;

    try {
      const groq = new Groq({ apiKey: keys[index], maxRetries: 0 });
      const model = params.model ?? GROQ_CHAT_MODEL;
      const completion = await groq.chat.completions.create({
        ...params,
        model,
        // Only reasoning models accept reasoning_effort; classifiers like Prompt Guard reject it.
        ...(model.startsWith("openai/gpt-oss") && params.reasoning_effort === undefined
          ? { reasoning_effort: "low" as const }
          : {}),
      });
      activeIndex = index;
      cooldownUntil.delete(index);
      return completion;
    } catch (err) {
      const cooldown = switchCooldownMs(err);
      if (cooldown === null) throw err;

      cooldownUntil.set(index, Date.now() + cooldown);
      activeIndex = (index + 1) % keys.length;
      const status = err instanceof Groq.APIError ? err.status ?? "network" : "network";
      console.warn(
        `[groq] key #${index + 1} unavailable (${status}), switching to #${activeIndex + 1}`
      );
    }
  }

  console.error(`[groq] all ${keys.length} keys exhausted or cooling down`);
  throw new GroqUnavailableError();
}
