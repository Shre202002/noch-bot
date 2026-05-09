"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Database, 
  Globe, 
  Activity, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Settings2, 
  Code2, 
  RefreshCw, 
  Zap,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Layout
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- Types & Data ---

type BotStatus = "Ready" | "Needs Crawl" | "Theme Incomplete" | "Embedded" | "Offline";

interface DashboardData {
  botName: string;
  websiteUrl: string;
  lastCrawl: string;
  chunksIndexed: number;
  messagesUsed: number;
  messageLimit: number;
  status: BotStatus;
  setupProgress: number;
}

const MOCK_DATA: DashboardData = {
  botName: "NochBot Assistant",
  websiteUrl: "https://nochbot.ai",
  lastCrawl: "2 hours ago",
  chunksIndexed: 1248,
  messagesUsed: 12402,
  messageLimit: 50000,
  status: "Ready",
  setupProgress: 80,
};

// --- Reusable Components ---

const StatCard = ({ title, value, label, icon: Icon, color, delay }: any) => {
  const colorMap: Record<string, string> = {
    green: "text-[#36f4a4] bg-[#36f4a4]/10 border-[#36f4a4]/20 shadow-[#36f4a4]/5",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-blue-400/5",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20 shadow-purple-400/5",
    orange: "text-orange-400 bg-orange-400/10 border-orange-400/20 shadow-orange-400/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1">
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity", color === 'green' ? 'from-[#36f4a4]' : 'from-primary')} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2.5 rounded-xl border transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
              <Icon className="h-5 w-5" />
            </div>
            {color === 'green' && (
              <Badge variant="outline" className="bg-[#36f4a4]/5 text-[#36f4a4] border-[#36f4a4]/20 text-[10px] font-bold uppercase tracking-wider">
                Active
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight text-foreground">{value}</h3>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const SetupStep = ({ title, completed, icon: Icon, href, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="group relative"
  >
    <Link href={href} className="flex items-center gap-4 p-4 rounded-2xl border border-transparent hover:border-border hover:bg-accent/30 transition-all">
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all",
        completed ? "bg-[#36f4a4]/10 border-[#36f4a4]/40 text-[#36f4a4]" : "bg-muted border-border text-muted-foreground"
      )}>
        {completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <h4 className={cn("text-sm font-semibold", completed ? "text-foreground" : "text-muted-foreground")}>{title}</h4>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  </motion.div>
);

const ActivityItem = ({ title, desc, time, color, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    viewport={{ once: true }}
    className="relative pl-8 pb-8 last:pb-0"
  >
    <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border last:hidden" />
    <div className={cn(
      "absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 border-[#0a0a0a] z-10",
      color === 'green' ? "bg-[#36f4a4]" : "bg-muted-foreground"
    )} />
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{time}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const QuickActionCard = ({ title, desc, icon: Icon, href, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.5 }}
  >
    <Link href={href}>
      <Card className="h-full border-border bg-accent/20 hover:bg-accent/40 hover:border-primary/20 transition-all group cursor-pointer overflow-hidden">
        <CardContent className="p-5 flex flex-col gap-3">
          <div className="p-2 w-fit rounded-lg bg-background border border-border group-hover:scale-110 group-hover:text-primary transition-all duration-300">
            <Icon className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{title}</h4>
            <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  </motion.div>
);

// --- Main Page Component ---

export default function DashboardOverviewPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      
      {/* SECTION 1 — HERO HEADER */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4 flex-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-[#36f4a4] animate-pulse" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-[#36f4a4]/40 animate-ping" />
            </div>
            <span className="text-xs font-bold text-[#36f4a4] uppercase tracking-[0.2em]">Operational</span>
          </motion.div>
          
          <div className="space-y-1">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-black tracking-tight"
            >
              Good morning, Developer.
            </motion.h1>
          </div>

          <motion.div 
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "100%" }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="max-w-md space-y-2 pt-2"
          >
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Setup Completion</span>
              <span className="text-foreground">{MOCK_DATA.setupProgress}%</span>
            </div>
            <Progress value={MOCK_DATA.setupProgress} className="h-1.5 bg-accent" />
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-3"
        >
          <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
            <Link href="/dashboard/configure">
              <Settings2 className="mr-2 h-4 w-4 group-hover:rotate-45 transition-transform" />
              Configure Bot
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
            <Link href="/dashboard/configure?tab=Preview">
              <Zap className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform text-yellow-500" />
              Test Chatbot
            </Link>
          </Button>
          <Button className="rounded-full bg-white text-black hover:opacity-90 transition-opacity font-bold" asChild>
            <Link href="/dashboard/configure?tab=Embed">
              <Code2 className="mr-2 h-4 w-4" />
              Embed Code
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* SECTION 2 — REAL STATS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Messages (30d)" 
          value={MOCK_DATA.messagesUsed.toLocaleString()} 
          label="82% resolution rate" 
          icon={MessageSquare} 
          color="blue"
          delay={0.1}
        />
        <StatCard 
          title="Knowledge Chunks" 
          value={MOCK_DATA.chunksIndexed.toLocaleString()} 
          label="Vector database ready" 
          icon={Database} 
          color="purple"
          delay={0.2}
        />
        <StatCard 
          title="Last Indexing" 
          value={MOCK_DATA.lastCrawl} 
          label="15 pages processed" 
          icon={Globe} 
          color="orange"
          delay={0.3}
        />
        <StatCard 
          title="Bot Status" 
          value={MOCK_DATA.status} 
          label="Responding in <1s" 
          icon={Activity} 
          color="green"
          delay={0.4}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        
        {/* SECTION 3 — LIVE BOT PREVIEW */}
        <div className="xl:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-border bg-card/30 backdrop-blur-xl overflow-hidden group">
              <div className="p-6 border-b border-border flex items-center justify-between bg-accent/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <Layout className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Live Staging Preview</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Active Profile: {MOCK_DATA.botName}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] px-2 py-0 border-border bg-background">
                  Local Staging
                </Badge>
              </div>
              <CardContent className="p-0 flex flex-col md:flex-row h-[400px]">
                {/* Visual Preview Side */}
                <div className="flex-1 bg-black/40 p-8 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 grid-bg opacity-10" />
                  <div className="relative z-10 flex flex-col items-center text-center gap-6">
                    <div className="h-20 w-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/20">
                      <Zap className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Alive</p>
                      <p className="text-sm text-muted-foreground max-w-[200px]">Connected to {MOCK_DATA.websiteUrl}</p>
                    </div>
                  </div>
                  
                  {/* Floating Bubble Mock */}
                  <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary shadow-2xl shadow-primary/40 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer">
                    <MessageSquare className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>

                {/* Interaction Mock Side */}
                <div className="w-full md:w-[320px] border-l border-border flex flex-col bg-background/50">
                  <div className="p-4 border-b border-border bg-accent/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#36f4a4] flex items-center justify-center text-black font-black text-xs">N</div>
                      <span className="text-xs font-bold">{MOCK_DATA.botName}</span>
                    </div>
                  </div>
                  <div className="flex-1 p-4 space-y-4 overflow-hidden">
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-accent/50 p-3 text-[11px] leading-relaxed">
                        Hi! I've indexed 1,248 chunks from your site. How can I help today?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary p-3 text-[11px] text-primary-foreground font-medium">
                        What are your main features?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="flex gap-1 p-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-border mt-auto">
                    <div className="h-9 rounded-full bg-accent/30 border border-border px-4 flex items-center text-[10px] text-muted-foreground italic">
                      Type to test...
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* SECTION 6 — QUICK ACTIONS */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Controls</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <QuickActionCard 
                title="Persona" 
                desc="Adjust voice & tone" 
                icon={Settings2} 
                href="/dashboard/configure" 
                delay={0.6}
              />
              <QuickActionCard 
                title="Retrain" 
                desc="Crawl latest content" 
                icon={RefreshCw} 
                href="/dashboard/configure" 
                delay={0.7}
              />
              <QuickActionCard 
                title="Visuals" 
                desc="Pick colors & icons" 
                icon={Zap} 
                href="/dashboard/configure" 
                delay={0.8}
              />
              <QuickActionCard 
                title="Embed" 
                desc="Get script snippet" 
                icon={Code2} 
                href="/dashboard/configure" 
                delay={0.9}
              />
              <QuickActionCard 
                title="Preview" 
                desc="Test new changes" 
                icon={Layout} 
                href="/dashboard/configure" 
                delay={1.0}
              />
              <QuickActionCard 
                title="Insights" 
                desc="Visitor analytics" 
                icon={Database} 
                href="/dashboard/analytics" 
                delay={1.1}
              />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          
          {/* SECTION 4 — SETUP CHECKLIST */}
          <Card className="border-border bg-card/50">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Path to Activation</h3>
              </div>
              <div className="space-y-1">
                <SetupStep title="Website Crawled" completed={true} icon={Globe} href="/dashboard/configure" delay={0.2} />
                <SetupStep title="Knowledge Indexed" completed={true} icon={Database} href="/dashboard/configure" delay={0.3} />
                <SetupStep title="Theme Customized" completed={true} icon={Zap} href="/dashboard/configure" delay={0.4} />
                <SetupStep title="Embed Installed" completed={false} icon={Code2} href="/dashboard/configure" delay={0.5} />
                <SetupStep title="First Interaction" completed={false} icon={MessageSquare} href="/dashboard/configure" delay={0.6} />
              </div>
            </CardContent>
          </Card>

          {/* SECTION 7 — USAGE PANEL */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Monthly Usage</h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Pro Plan</Badge>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="text-foreground">12.4k / 50k</span>
                  </div>
                  <Progress value={24} className="h-1.5 bg-accent" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-muted-foreground">Chunk Storage</span>
                    <span className="text-foreground">1.2k / 5k</span>
                  </div>
                  <Progress value={24} className="h-1.5 bg-accent" />
                </div>
                <Button className="w-full h-10 rounded-xl" variant="outline">
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 5 — RECENT ACTIVITY */}
          <Card className="border-border bg-card/50">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Recent Activity</h3>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
                  <Link href="/dashboard/analytics">View History</Link>
                </Button>
              </div>
              <div className="relative">
                <ActivityItem 
                  title="Knowledge Synced" 
                  desc="12 new chunks indexed from nochbot.ai/docs" 
                  time="2m ago" 
                  color="green"
                  delay={0.1}
                />
                <ActivityItem 
                  title="Theme Updated" 
                  desc="Primary accent color changed to #36F4A4" 
                  time="1h ago" 
                  color="gray"
                  delay={0.2}
                />
                <ActivityItem 
                  title="Crawler Complete" 
                  desc="Successfully indexed 15 pages of content" 
                  time="3h ago" 
                  color="green"
                  delay={0.3}
                />
                <ActivityItem 
                  title="Script Copied" 
                  desc="Integration snippet copied to clipboard" 
                  time="5h ago" 
                  color="gray"
                  delay={0.4}
                />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
