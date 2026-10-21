"use client";

import { useEffect, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** The one script that puts the assistant, and event booking, on a website. Same snippet as the Embed page. */
export function embedSnippet(origin: string, userId: string): string {
  return `<script
  src="${origin}/embed.js"
  data-user-id="${userId}"
  defer>
</script>`;
}

/**
 * The embed code, shown where it is needed (Bookings, and the "event is live" screen), so an organizer does not have
 * to leave the page to find it.
 */
export function EmbedCodeCard({ compact = false }: { compact?: boolean }) {
  const [userId, setUserId] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.id) setUserId(d.id);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const code = userId && origin ? embedSnippet(origin, userId) : "";

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Card className="border-white/10 bg-card/40">
      <CardContent className={compact ? "space-y-3 p-4" : "space-y-4 p-5"}>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-content-center rounded-xl bg-[#36f4a4]/10 text-[#36f4a4]">
            <Code2 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Put booking on your website</h3>
            <p className="text-xs text-muted-foreground">
              Paste this before the closing <code className="rounded bg-white/10 px-1">&lt;/body&gt;</code> tag. One script adds the chat assistant and lets visitors book your live events.
            </p>
          </div>
        </div>

        <div className="relative rounded-xl border border-white/10 bg-black/70 p-4">
          {code ? (
            <pre className="overflow-x-auto pr-20 text-xs leading-6 text-green-400">
              <code>{code}</code>
            </pre>
          ) : (
            <p className="text-xs text-white/50" role="status">
              {failed ? "Could not load your embed code. Open the Embed Codes page instead." : "Generating your script…"}
            </p>
          )}
          <Button
            size="sm"
            onClick={copy}
            disabled={!code}
            aria-label="Copy embed code"
            className="absolute right-3 top-3 cursor-pointer rounded-lg bg-[#36f4a4] font-bold text-black hover:bg-[#36f4a4]/90"
          >
            {copied ? <Check aria-hidden="true" className="mr-1.5 h-4 w-4" /> : <Copy aria-hidden="true" className="mr-1.5 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
