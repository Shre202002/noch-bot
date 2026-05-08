"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  Code2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Bot,
} from "lucide-react";

export default function EmbedPage() {
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setBaseUrl(window.location.origin);

    // Fetch real userId from our session API
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.id) {
          setUserId(d.id);
        }
      })
      .catch(() => {
        // Fallback for local testing if needed
        const id = localStorage.getItem("nocta_user_id") || "YOUR_USER_ID";
        setUserId(id);
      });
  }, []);

  const embedCode = !mounted ? "" : `<script
  src="${baseUrl}/embed.js"
  data-user-id="${userId}"
  defer>
</script>`;

  async function copyCode() {
    if (!embedCode) return;
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HERO */}
      <div className="flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Deployment Ready
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Embed Your Chatbot
          </h1>

          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Install Nocta on your website with a single script.
            Your AI assistant will instantly appear across your
            website and start responding using your trained
            knowledge base.
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* LEFT SECTION */}
        <div className="space-y-6 lg:col-span-2">
          {/* INSTALLATION CARD */}
          <Card className="rounded-3xl border-border/60 bg-card/70 shadow-xl backdrop-blur">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Code2 className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle className="text-xl">
                    Installation Script
                  </CardTitle>

                  <CardDescription>
                    Copy and paste this script before the closing body tag of your website.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* CODE BLOCK */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-black/90 p-5 min-h-[140px]">
                {!mounted ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs text-muted-foreground animate-pulse">Generating script...</span>
                  </div>
                ) : (
                  <>
                    <pre className="overflow-x-auto text-sm leading-7 text-green-400">
                      <code>{embedCode}</code>
                    </pre>

                    <Button
                      size="sm"
                      onClick={copyCode}
                      className="absolute right-4 top-4 rounded-xl cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* STEPS */}
              <div className="grid gap-4 md:grid-cols-3">
                <StepCard
                  step="1"
                  title="Copy Script"
                  desc="Copy the generated embed script for your chatbot."
                />

                <StepCard
                  step="2"
                  title="Paste Into Website"
                  desc="Add the script before the closing body tag."
                />

                <StepCard
                  step="3"
                  title="Go Live"
                  desc="Your chatbot will instantly appear across your site."
                />
              </div>
            </CardContent>
          </Card>

          {/* SECURITY / FEATURES */}
          <Card className="rounded-3xl border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500/10 text-green-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle className="text-lg">
                    Optimized For Production
                  </CardTitle>

                  <CardDescription>
                    Lightweight, secure and designed for modern websites.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                title="Fast Loading"
                desc="Loads asynchronously without blocking your website."
              />

              <FeatureCard
                title="Theme Synced"
                desc="Automatically uses your configured branding colors."
              />

              <FeatureCard
                title="Live Updates"
                desc="Updates instantly after re-crawling your website."
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-6">
          {/* BOT STATUS */}
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/70 backdrop-blur">
            <div className="border-b border-border bg-primary/5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-6 w-6" />
                </div>

                <div>
                  <p className="font-semibold">
                    Chatbot Status
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />

                    <span className="text-xs text-muted-foreground">
                      Online & Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="space-y-4 p-6">
              <StatusRow
                label="Knowledge Base"
                value="Indexed"
              />

              <StatusRow
                label="Theme"
                value="Configured"
              />

              <StatusRow
                label="Embed Script"
                value="Ready"
              />

              <StatusRow
                label="Deployment"
                value="Production"
              />
            </CardContent>
          </Card>

          {/* TEST CARD */}
          <Card className="rounded-3xl border-border/60 bg-gradient-to-b from-primary/10 to-transparent backdrop-blur">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold">
                  Test Your Chatbot
                </h3>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  Open your website and verify your chatbot is responding correctly.
                </p>
              </div>

              <Button className="w-full rounded-2xl cursor-pointer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Website
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* STEP CARD */
function StepCard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-accent/20 p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </div>

      <h4 className="font-semibold">
        {title}
      </h4>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

/* FEATURE CARD */
function FeatureCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-accent/20 p-5 transition-all hover:border-primary/20 hover:bg-accent/30">
      <h4 className="font-semibold">
        {title}
      </h4>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

/* STATUS ROW */
function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-accent/20 px-4 py-3">
      <span className="text-sm text-muted-foreground">
        {label}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}