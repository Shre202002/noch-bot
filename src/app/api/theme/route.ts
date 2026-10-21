import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { readKnowledge, writeKnowledge } from "@/lib/storage";
import { isKnownLauncherIcon, launcherIconUrl } from "@/lib/launcherIcons";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId)
    return NextResponse.json(
      { error: "No userId" },
      { status: 400, headers: corsHeaders }
    );

  const knowledge = await readKnowledge(userId);

  // Priority: theme object → botColor fallback → null
  let theme = knowledge?.theme || null;

  if (!theme && knowledge?.botColor) {
    theme = {
      bubbleColor: knowledge.botColor,
      headerColor: knowledge.botColor,
      userMsgColor: knowledge.botColor,
      sendBtnColor: knowledge.botColor,
      accentColor: knowledge.botColor,
    };
  }

  // The widget gets the image path from our own list, never from what was saved: any `launcherIconUrl` found in the
  // stored theme is dropped, and the one sent is worked out from the icon id.
  let result: Record<string, unknown> | null = null;
  if (theme) {
    const { launcherIconUrl: _stored, ...rest } = theme as Record<string, unknown>;
    // Drawn in the chat bubble's colour, so the icon matches the rest of the chatbot.
    const iconUrl = launcherIconUrl(rest.launcherIcon, typeof rest.bubbleColor === "string" ? rest.bubbleColor : null);
    result = { ...rest, ...(iconUrl ? { launcherIconUrl: iconUrl } : {}) };
  }

  return NextResponse.json(
    { theme: result },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );

  const { theme } = await req.json();

  if (theme?.launcherIcon !== undefined && !isKnownLauncherIcon(theme.launcherIcon)) {
    return NextResponse.json({ error: "Unknown chat icon" }, { status: 400, headers: corsHeaders });
  }
  // The image path is derived on the way out, so it is never stored (or trusted) from a request.
  if (theme && typeof theme === "object") delete theme.launcherIconUrl;

  // Partial update — sirf theme field update karo
  await writeKnowledge(userId, { theme });

  return NextResponse.json(
    { success: true },
    { headers: corsHeaders }
  );
}