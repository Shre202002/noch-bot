"use client";

import { useEffect, useState } from "react";
import { MailCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailVerificationCard({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/verify-email/send", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.retryAfterSec) setCooldown(data.retryAfterSec);
        throw new Error(data.error || "Could not send the code");
      }
      setSent(true);
      setCooldown(data.resendAfterSec ?? 60);
      setMsg({ type: "success", text: `We sent a 6-digit code to ${email}.` });
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setMsg({ type: "success", text: "Email verified. You can now set up your assistant." });
      onVerified();
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <MailCheck className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="font-bold">Verify your email</h2>
            <p className="text-xs text-muted-foreground">
              Required before you can crawl a website, upload documents or set up a chatbot.
            </p>
          </div>
        </div>

        {!sent ? (
          <Button onClick={send} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send code to {email}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40 text-center tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="6-digit verification code"
            />
            <Button onClick={confirm} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
            <Button variant="ghost" onClick={send} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
          </div>
        )}

        {msg && (
          <p className={`flex items-center gap-2 text-sm ${msg.type === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {msg.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
