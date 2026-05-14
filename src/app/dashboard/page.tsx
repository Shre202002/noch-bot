"use client";

// import { useState, useEffect } from "react";
// import { motion } from "framer-motion";
// import {
//   MessageSquare, Database, Globe, Activity,
//   Settings2, Code2, RefreshCw, Zap,
//   ChevronRight, ShieldCheck, Layout,
//   CheckCircle2, Loader2, TrendingUp, Clock
// } from "lucide-react";
// import Link from "next/link";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Progress } from "@/components/ui/progress";
// import { Badge } from "@/components/ui/badge";
// import { cn } from "@/lib/utils";

// // ── Types ────────────────────────────────────────────────────────
// interface OverviewData {
//   // from /api/analytics
//   totalConversations: number;
//   totalMessages: number;
//   avgResponseTimeMs: number;
//   activeToday: number;
//   chunksIndexed: number;
//   lastCrawl: string | null;
//   botName: string;
//   websiteUrl: string;
//   topQuestions: { question: string; count: number }[];
//   // from /api/auth/me
//   name: string | null;
//   email: string;
//   plan: "free" | "starter" | "pro";
//   crawlCount: number;
// }

// // ── Helpers ──────────────────────────────────────────────────────
// function timeAgo(dateStr: string | null) {
//   if (!dateStr) return "Never";
//   const diff = Date.now() - new Date(dateStr).getTime();
//   const mins = Math.floor(diff / 60000);
//   if (mins < 1) return "Just now";
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   return `${Math.floor(hrs / 24)}d ago`;
// }

// function greeting() {
//   const h = new Date().getHours();
//   if (h < 12) return "Good morning";
//   if (h < 17) return "Good afternoon";
//   return "Good evening";
// }

// function formatMs(ms: number) {
//   if (!ms) return "—";
//   return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
// }

// // ── Sub-components ───────────────────────────────────────────────
// const StatCard = ({ title, value, label, icon: Icon, color, delay }: any) => {
//   const colorMap: Record<string, string> = {
//     green:  "text-[#36f4a4] bg-[#36f4a4]/10 border-[#36f4a4]/20",
//     blue:   "text-blue-400 bg-blue-400/10 border-blue-400/20",
//     purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
//     orange: "text-orange-400 bg-orange-400/10 border-orange-400/20",
//   };
//   return (
//     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}>
//       <Card className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1">
//         <CardContent className="p-6">
//           <div className="flex items-center justify-between mb-4">
//             <div className={cn("p-2.5 rounded-xl border transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
//               <Icon className="h-5 w-5" />
//             </div>
//             {color === "green" && (
//               <Badge variant="outline" className="bg-[#36f4a4]/5 text-[#36f4a4] border-[#36f4a4]/20 text-[10px] font-bold uppercase tracking-wider">
//                 Live
//               </Badge>
//             )}
//           </div>
//           <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
//           <h3 className="text-3xl font-bold tracking-tight text-foreground mt-1">{value}</h3>
//           <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
//         </CardContent>
//       </Card>
//     </motion.div>
//   );
// };

// const SetupStep = ({ title, completed, icon: Icon, href, delay }: any) => (
//   <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.5 }} className="group">
//     <Link href={href} className="flex items-center gap-4 p-4 rounded-2xl border border-transparent hover:border-border hover:bg-accent/30 transition-all">
//       <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all",
//         completed ? "bg-[#36f4a4]/10 border-[#36f4a4]/40 text-[#36f4a4]" : "bg-muted border-border text-muted-foreground"
//       )}>
//         {completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
//       </div>
//       <h4 className={cn("text-sm font-semibold flex-1", completed ? "text-foreground" : "text-muted-foreground")}>{title}</h4>
//       <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
//     </Link>
//   </motion.div>
// );

// const QuickActionCard = ({ title, desc, icon: Icon, href, delay }: any) => (
//   <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.5 }}>
//     <Link href={href}>
//       <Card className="h-full border-border bg-accent/20 hover:bg-accent/40 hover:border-primary/20 transition-all group cursor-pointer overflow-hidden">
//         <CardContent className="p-5 flex flex-col gap-3">
//           <div className="p-2 w-fit rounded-lg bg-background border border-border group-hover:scale-110 group-hover:text-primary transition-all duration-300">
//             <Icon className="h-4 w-4" />
//           </div>
//           <div className="space-y-1">
//             <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{title}</h4>
//             <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
//           </div>
//         </CardContent>
//       </Card>
//     </Link>
//   </motion.div>
// );

// // ── Main Component ────────────────────────────────────────────────
// export default function DashboardOverviewPage() {
//   const [data, setData] = useState<OverviewData | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     Promise.all([
//       fetch("/api/analytics").then((r) => r.json()),
//       fetch("/api/auth/me").then((r) => r.json()),
//     ]).then(([analytics, user]) => {
//       setData({ ...analytics, ...user });
//       setLoading(false);
//     }).catch(() => setLoading(false));
//   }, []);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
//       </div>
//     );
//   }

//   const hasCrawled = !!data?.lastCrawl;
//   const hasChunks = (data?.chunksIndexed ?? 0) > 0;
//   const hasConversations = (data?.totalConversations ?? 0) > 0;

//   // Setup progress calculation
//   const steps = [hasCrawled, hasChunks, true, hasConversations];
//   const setupProgress = Math.round((steps.filter(Boolean).length / steps.length) * 100);

//   const displayName = data?.name || data?.email?.split("@")[0] || "Developer";

//   return (
//     <div className="space-y-10 pb-20 max-w-7xl mx-auto">

//       {/* HERO HEADER */}
//       <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
//         <div className="space-y-4 flex-1">
//           <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
//             <div className="relative">
//               <div className="h-3 w-3 rounded-full bg-[#36f4a4] animate-pulse" />
//               <div className="absolute inset-0 h-3 w-3 rounded-full bg-[#36f4a4]/40 animate-ping" />
//             </div>
//             <span className="text-xs font-bold text-[#36f4a4] uppercase tracking-[0.2em]">Operational</span>
//           </motion.div>

//           <div className="space-y-1">
//             <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-black tracking-tight">
//               {greeting()}, {displayName}.
//             </motion.h1>
//             <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-muted-foreground">
//               {data?.websiteUrl
//                 ? <>Your AI assistant is live at <span className="text-foreground font-semibold">{data.websiteUrl}</span></>
//                 : "Set up your AI chatbot to get started"}
//             </motion.p>
//           </div>

//           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="max-w-md space-y-2 pt-2">
//             <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
//               <span>Setup Completion</span>
//               <span className="text-foreground">{setupProgress}%</span>
//             </div>
//             <Progress value={setupProgress} className="h-1.5 bg-accent" />
//           </motion.div>
//         </div>

//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-3">
//           <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
//             <Link href="/dashboard/configure">
//               <Settings2 className="mr-2 h-4 w-4 group-hover:rotate-45 transition-transform" />
//               Configure Bot
//             </Link>
//           </Button>
//           <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
//             <Link href="/dashboard/configure?tab=Preview">
//               <Zap className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform text-yellow-500" />
//               Test Chatbot
//             </Link>
//           </Button>
//           <Button className="rounded-full bg-white text-black hover:opacity-90 transition-opacity font-bold" asChild>
//             <Link href="/dashboard/configure?tab=Embed">
//               <Code2 className="mr-2 h-4 w-4" />
//               Embed Code
//             </Link>
//           </Button>
//         </motion.div>
//       </section>

//       {/* STATS GRID */}
//       <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//         <StatCard title="Total Messages" value={(data?.totalMessages ?? 0).toLocaleString()} label={`${data?.totalConversations ?? 0} conversations total`} icon={MessageSquare} color="blue" delay={0.1} />
//         <StatCard title="Knowledge Chunks" value={(data?.chunksIndexed ?? 0).toLocaleString()} label="Vector database ready" icon={Database} color="purple" delay={0.2} />
//         <StatCard title="Last Crawl" value={timeAgo(data?.lastCrawl ?? null)} label={data?.websiteUrl || "No website yet"} icon={Globe} color="orange" delay={0.3} />
//         <StatCard title="Active Today" value={(data?.activeToday ?? 0).toLocaleString()} label={`Avg ${formatMs(data?.avgResponseTimeMs ?? 0)} response`} icon={Activity} color="green" delay={0.4} />
//       </section>

//       <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">

//         {/* LEFT — Preview + Quick Actions */}
//         <div className="xl:col-span-2 space-y-8">
//           <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
//             <Card className="border-border bg-card/30 backdrop-blur-xl overflow-hidden">
//               <div className="p-6 border-b border-border flex items-center justify-between bg-accent/10">
//                 <div className="flex items-center gap-3">
//                   <div className="p-2 rounded-lg bg-background border border-border">
//                     <Layout className="h-4 w-4 text-primary" />
//                   </div>
//                   <div>
//                     <h3 className="text-sm font-bold">Live Staging Preview</h3>
//                     <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
//                       Active: {data?.botName || "AI Assistant"}
//                     </p>
//                   </div>
//                 </div>
//                 <Badge variant="secondary" className="text-[10px] px-2 py-0 border-border bg-background">
//                   {data?.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) + " Plan" : "Free Plan"}
//                 </Badge>
//               </div>
//               <CardContent className="p-0 flex flex-col md:flex-row h-[400px]">
//                 {/* Visual side */}
//                 <div className="flex-1 bg-black/40 p-8 flex items-center justify-center relative overflow-hidden">
//                   <div className="relative z-10 flex flex-col items-center text-center gap-6">
//                     <div className="h-20 w-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/20">
//                       <Zap className="h-10 w-10 text-primary animate-pulse" />
//                     </div>
//                     <div className="space-y-1">
//                       <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
//                         {hasChunks ? "Ready" : "Needs Setup"}
//                       </p>
//                       <p className="text-sm text-muted-foreground max-w-[200px]">
//                         {data?.websiteUrl || "No website crawled yet"}
//                       </p>
//                       {data?.totalMessages ? (
//                         <p className="text-xs text-[#36f4a4] font-semibold">
//                           {data.totalMessages.toLocaleString()} messages handled
//                         </p>
//                       ) : null}
//                     </div>
//                   </div>
//                   <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary shadow-2xl shadow-primary/40 flex items-center justify-center">
//                     <MessageSquare className="h-6 w-6 text-primary-foreground" />
//                   </div>
//                 </div>

//                 {/* Top questions side */}
//                 <div className="w-full md:w-[320px] border-l border-border flex flex-col bg-background/50">
//                   <div className="p-4 border-b border-border bg-accent/5">
//                     <div className="flex items-center gap-2">
//                       <TrendingUp className="h-4 w-4 text-[#36f4a4]" />
//                       <span className="text-xs font-bold">Top Questions</span>
//                     </div>
//                   </div>
//                   <div className="flex-1 p-3 space-y-2 overflow-y-auto">
//                     {(data?.topQuestions?.length ?? 0) === 0 ? (
//                       <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-4">
//                         Questions from visitors will appear here
//                       </div>
//                     ) : (
//                       data?.topQuestions?.slice(0, 5).map((q, i) => (
//                         <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/30 transition-colors">
//                           <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0 mt-0.5">#{i + 1}</span>
//                           <p className="text-[11px] text-foreground leading-relaxed flex-1">{q.question}</p>
//                           <Badge variant="secondary" className="text-[9px] shrink-0">{q.count}×</Badge>
//                         </div>
//                       ))
//                     )}
//                   </div>
//                   <div className="p-4 border-t border-border">
//                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
//                       <Clock className="h-3 w-3" />
//                       Avg response: <span className="text-foreground font-semibold">{formatMs(data?.avgResponseTimeMs ?? 0)}</span>
//                     </div>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </motion.div>

//           {/* Quick Actions */}
//           <section className="space-y-4">
//             <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Controls</h3>
//             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
//               <QuickActionCard title="Persona"  desc="Adjust voice & tone"    icon={Settings2}  href="/dashboard/configure"           delay={0.6} />
//               <QuickActionCard title="Retrain"  desc="Crawl latest content"   icon={RefreshCw}  href="/dashboard/configure"           delay={0.7} />
//               <QuickActionCard title="Visuals"  desc="Pick colors & icons"    icon={Zap}        href="/dashboard/configure"           delay={0.8} />
//               <QuickActionCard title="Embed"    desc="Get script snippet"     icon={Code2}      href="/dashboard/configure"           delay={0.9} />
//               <QuickActionCard title="Preview"  desc="Test new changes"       icon={Layout}     href="/dashboard/configure"           delay={1.0} />
//               <QuickActionCard title="Insights" desc="Visitor analytics"      icon={Database}   href="/dashboard/analytics"          delay={1.1} />
//             </div>
//           </section>
//         </div>

//         {/* RIGHT COLUMN */}
//         <div className="space-y-8">

//           {/* Setup Checklist */}
//           <Card className="border-border bg-card/50">
//             <CardContent className="p-6 space-y-6">
//               <div className="flex items-center gap-3">
//                 <ShieldCheck className="h-5 w-5 text-primary" />
//                 <h3 className="font-bold">Path to Activation</h3>
//               </div>
//               <div className="space-y-1">
//                 <SetupStep title="Website Crawled"    completed={hasCrawled}          icon={Globe}         href="/dashboard/configure" delay={0.2} />
//                 <SetupStep title="Knowledge Indexed"  completed={hasChunks}           icon={Database}      href="/dashboard/configure" delay={0.3} />
//                 <SetupStep title="Theme Customized"   completed={true}                icon={Zap}           href="/dashboard/configure" delay={0.4} />
//                 <SetupStep title="First Interaction"  completed={hasConversations}    icon={MessageSquare} href="/dashboard/history"   delay={0.5} />
//               </div>
//             </CardContent>
//           </Card>

//           {/* Usage Panel */}
//           <Card className="border-border bg-card shadow-sm">
//             <CardContent className="p-6 space-y-6">
//               <div className="flex items-center justify-between">
//                 <h3 className="font-bold text-sm">Monthly Usage</h3>
//                 <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 capitalize">
//                   {data?.plan || "free"} Plan
//                 </Badge>
//               </div>
//               <div className="space-y-6">
//                 <div className="space-y-2">
//                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
//                     <span className="text-muted-foreground">Messages</span>
//                     <span className="text-foreground">{(data?.totalMessages ?? 0).toLocaleString()} used</span>
//                   </div>
//                   <Progress
//                     value={Math.min(((data?.totalMessages ?? 0) / (data?.plan === "pro" ? 50000 : data?.plan === "starter" ? 10000 : 1000)) * 100, 100)}
//                     className="h-1.5 bg-accent"
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
//                     <span className="text-muted-foreground">Chunk Storage</span>
//                     <span className="text-foreground">{(data?.chunksIndexed ?? 0).toLocaleString()} chunks</span>
//                   </div>
//                   <Progress
//                     value={Math.min(((data?.chunksIndexed ?? 0) / 5000) * 100, 100)}
//                     className="h-1.5 bg-accent"
//                   />
//                 </div>
//                 <Button className="w-full h-10 rounded-xl" variant="outline" asChild>
//                   <Link href="/dashboard/account">Manage Subscription</Link>
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Recent Stats */}
//           <Card className="border-border bg-card/50">
//             <CardContent className="p-6 space-y-4">
//               <div className="flex items-center justify-between">
//                 <h3 className="font-bold text-sm">Quick Stats</h3>
//                 <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
//                   <Link href="/dashboard/analytics">View All</Link>
//                 </Button>
//               </div>
//               <div className="space-y-3">
//                 {[
//                   { label: "Total Conversations", value: (data?.totalConversations ?? 0).toLocaleString(), color: "text-blue-400" },
//                   { label: "Active Today",         value: (data?.activeToday ?? 0).toLocaleString(),        color: "text-[#36f4a4]" },
//                   { label: "Avg Response Time",    value: formatMs(data?.avgResponseTimeMs ?? 0),            color: "text-orange-400" },
//                   { label: "Pages Crawled",        value: `${data?.crawlCount ?? 0} crawls`,                 color: "text-purple-400" },
//                 ].map(({ label, value, color }) => (
//                   <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
//                     <span className="text-xs text-muted-foreground">{label}</span>
//                     <span className={cn("text-sm font-bold", color)}>{value}</span>
//                   </div>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }









// "use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Database, Globe, Activity,
  Settings2, Code2, RefreshCw, Zap,
  ChevronRight, ShieldCheck, Layout,
  CheckCircle2, Loader2, TrendingUp, Clock,
  AlertTriangle, Crown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuotaData {
  used: number;
  limit: number;
  remaining: number;
  resetDate?: string;
  percentUsed: number;
}

interface OverviewData {
  totalConversations: number;
  totalMessages: number;
  avgResponseTimeMs: number;
  activeToday: number;
  chunksIndexed: number;
  lastCrawl: string | null;
  botName: string;
  websiteUrl: string;
  topQuestions: { question: string; count: number }[];
  name: string | null;
  email: string;
  plan: "free" | "starter" | "pro";
  crawlCount: number;
  quota: {
    messages: QuotaData;
    crawls: QuotaData;
  };
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatMs(ms: number) {
  if (!ms) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ── Quota Bar Component ──────────────────────────────────────────
const QuotaBar = ({
  label, used, limit, remaining, percentUsed, resetDate, icon: Icon
}: {
  label: string; used: number; limit: number; remaining: number;
  percentUsed: number; resetDate?: string; icon: any;
}) => {
  const isWarning = percentUsed >= 75 && percentUsed < 90;
  const isDanger = percentUsed >= 90;
  const isExhausted = percentUsed >= 100;

  const barColor = isExhausted
    ? "bg-red-500"
    : isDanger
    ? "bg-orange-500"
    : isWarning
    ? "bg-yellow-500"
    : "bg-[#36f4a4]";

  const textColor = isExhausted
    ? "text-red-400"
    : isDanger
    ? "text-orange-400"
    : isWarning
    ? "text-yellow-400"
    : "text-[#36f4a4]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", textColor)} />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {(isWarning || isDanger) && (
            <AlertTriangle className={cn("h-3 w-3", textColor)} />
          )}
          <span className={cn("text-xs font-black", textColor)}>
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentUsed, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", barColor)}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">
          {remaining.toLocaleString()} remaining
        </span>
        {resetDate && (
          <span className="text-[10px] text-muted-foreground">
            Resets {resetDate}
          </span>
        )}
      </div>

      {isExhausted && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400">
            Limit reached — upgrade to continue
          </span>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, label, icon: Icon, color, delay }: any) => {
  const colorMap: Record<string, string> = {
    green:  "text-[#36f4a4] bg-[#36f4a4]/10 border-[#36f4a4]/20",
    blue:   "text-blue-400 bg-blue-400/10 border-blue-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    orange: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}>
      <Card className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2.5 rounded-xl border transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
              <Icon className="h-5 w-5" />
            </div>
            {color === "green" && (
              <Badge variant="outline" className="bg-[#36f4a4]/5 text-[#36f4a4] border-[#36f4a4]/20 text-[10px] font-bold uppercase tracking-wider">
                Live
              </Badge>
            )}
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight text-foreground mt-1">{value}</h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const SetupStep = ({ title, completed, icon: Icon, href, delay }: any) => (
  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.5 }} className="group">
    <Link href={href} className="flex items-center gap-4 p-4 rounded-2xl border border-transparent hover:border-border hover:bg-accent/30 transition-all">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all",
        completed ? "bg-[#36f4a4]/10 border-[#36f4a4]/40 text-[#36f4a4]" : "bg-muted border-border text-muted-foreground"
      )}>
        {completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <h4 className={cn("text-sm font-semibold flex-1", completed ? "text-foreground" : "text-muted-foreground")}>{title}</h4>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  </motion.div>
);

const QuickActionCard = ({ title, desc, icon: Icon, href, delay }: any) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.5 }}>
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

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([analytics, user]) => {
      setData({ ...analytics, ...user });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCrawled = !!data?.lastCrawl;
  const hasChunks = (data?.chunksIndexed ?? 0) > 0;
  const hasConversations = (data?.totalConversations ?? 0) > 0;
  const setupProgress = Math.round(([hasCrawled, hasChunks, true, hasConversations].filter(Boolean).length / 4) * 100);
  const displayName = data?.name || data?.email?.split("@")[0] || "Developer";

  const msgQuota = data?.quota?.messages;
  const crawlQuota = data?.quota?.crawls;
  const isNearLimit = (msgQuota?.percentUsed ?? 0) >= 75;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">

      {/* ── QUOTA WARNING BANNER ── */}
      {isNearLimit && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className={cn(
            "flex items-center gap-3 p-4 rounded-2xl border",
            (msgQuota?.percentUsed ?? 0) >= 100
              ? "bg-red-500/10 border-red-500/30"
              : "bg-yellow-500/10 border-yellow-500/30"
          )}>
            <AlertTriangle className={cn("h-5 w-5 shrink-0",
              (msgQuota?.percentUsed ?? 0) >= 100 ? "text-red-400" : "text-yellow-400"
            )} />
            <div className="flex-1">
              <p className={cn("text-sm font-bold",
                (msgQuota?.percentUsed ?? 0) >= 100 ? "text-red-400" : "text-yellow-400"
              )}>
                {(msgQuota?.percentUsed ?? 0) >= 100
                  ? "Message limit reached! Your chatbot is paused."
                  : `${msgQuota?.percentUsed}% of your monthly message quota used`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {msgQuota?.remaining.toLocaleString()} messages remaining · Resets {msgQuota?.resetDate}
              </p>
            </div>
            <Button size="sm" className="rounded-full shrink-0 bg-white text-black hover:opacity-90" asChild>
              <Link href="/dashboard/account">
                <Crown className="h-3.5 w-3.5 mr-1.5" />
                Upgrade
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── HERO HEADER ── */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4 flex-1">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-[#36f4a4] animate-pulse" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-[#36f4a4]/40 animate-ping" />
            </div>
            <span className="text-xs font-bold text-[#36f4a4] uppercase tracking-[0.2em]">Operational</span>
          </motion.div>
          <div className="space-y-1">
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-black tracking-tight">
              {greeting()}, {displayName}.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-muted-foreground">
              {data?.websiteUrl
                ? <>Your AI assistant is live at <span className="text-foreground font-semibold">{data.websiteUrl}</span></>
                : "Set up your AI chatbot to get started"}
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="max-w-md space-y-2 pt-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Setup Completion</span>
              <span className="text-foreground">{setupProgress}%</span>
            </div>
            <Progress value={setupProgress} className="h-1.5 bg-accent" />
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
            <Link href="/dashboard/configure"><Settings2 className="mr-2 h-4 w-4 group-hover:rotate-45 transition-transform" />Configure Bot</Link>
          </Button>
          <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all group" asChild>
            <Link href="/dashboard/configure?tab=Preview"><Zap className="mr-2 h-4 w-4 text-yellow-500" />Test Chatbot</Link>
          </Button>
          <Button className="rounded-full bg-white text-black hover:opacity-90 font-bold" asChild>
            <Link href="/dashboard/configure?tab=Embed"><Code2 className="mr-2 h-4 w-4" />Embed Code</Link>
          </Button>
        </motion.div>
      </section>

      {/* ── STATS GRID ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Messages"    value={(data?.totalMessages ?? 0).toLocaleString()}     label={`${data?.totalConversations ?? 0} conversations total`}   icon={MessageSquare} color="blue"   delay={0.1} />
        <StatCard title="Knowledge Chunks"  value={(data?.chunksIndexed ?? 0).toLocaleString()}     label="Vector database ready"                                    icon={Database}      color="purple" delay={0.2} />
        <StatCard title="Last Crawl"        value={timeAgo(data?.lastCrawl ?? null)}                label={data?.websiteUrl || "No website yet"}                     icon={Globe}         color="orange" delay={0.3} />
        <StatCard title="Active Today"      value={(data?.activeToday ?? 0).toLocaleString()}       label={`Avg ${formatMs(data?.avgResponseTimeMs ?? 0)} response`} icon={Activity}      color="green"  delay={0.4} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">

        {/* ── LEFT ── */}
        <div className="xl:col-span-2 space-y-8">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="border-border bg-card/30 backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between bg-accent/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <Layout className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Live Preview</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Active: {data?.botName || "AI Assistant"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] px-2 py-0 border-border bg-background capitalize">
                  {data?.plan || "free"} Plan
                </Badge>
              </div>
              <CardContent className="p-0 flex flex-col md:flex-row h-[400px]">
                <div className="flex-1 bg-black/40 p-8 flex items-center justify-center relative overflow-hidden">
                  <div className="relative z-10 flex flex-col items-center text-center gap-6">
                    <div className="h-20 w-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/20">
                      <Zap className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                        {hasChunks ? "Ready" : "Needs Setup"}
                      </p>
                      <p className="text-sm text-muted-foreground max-w-[200px]">{data?.websiteUrl || "No website crawled yet"}</p>
                      {data?.totalMessages ? (
                        <p className="text-xs text-[#36f4a4] font-semibold">{data.totalMessages.toLocaleString()} messages handled</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary shadow-2xl shadow-primary/40 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div className="w-full md:w-[320px] border-l border-border flex flex-col bg-background/50">
                  <div className="p-4 border-b border-border bg-accent/5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#36f4a4]" />
                      <span className="text-xs font-bold">Top Questions</span>
                    </div>
                  </div>
                  <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {(data?.topQuestions?.length ?? 0) === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-4">
                        Questions from visitors will appear here
                      </div>
                    ) : (
                      data?.topQuestions?.slice(0, 5).map((q, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                          <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0 mt-0.5">#{i + 1}</span>
                          <p className="text-[11px] text-foreground leading-relaxed flex-1">{q.question}</p>
                          <Badge variant="secondary" className="text-[9px] shrink-0">{q.count}×</Badge>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Avg response: <span className="text-foreground font-semibold">{formatMs(data?.avgResponseTimeMs ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Controls</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <QuickActionCard title="Persona"  desc="Adjust voice & tone"  icon={Settings2} href="/dashboard/configure"  delay={0.6} />
              <QuickActionCard title="Retrain"  desc="Crawl latest content" icon={RefreshCw} href="/dashboard/configure"  delay={0.7} />
              <QuickActionCard title="Visuals"  desc="Pick colors & icons"  icon={Zap}       href="/dashboard/configure"  delay={0.8} />
              <QuickActionCard title="Embed"    desc="Get script snippet"   icon={Code2}     href="/dashboard/configure"  delay={0.9} />
              <QuickActionCard title="Preview"  desc="Test new changes"     icon={Layout}    href="/dashboard/configure"  delay={1.0} />
              <QuickActionCard title="Insights" desc="Visitor analytics"    icon={Database}  href="/dashboard/analytics" delay={1.1} />
            </div>
          </section>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-8">

          {/* Setup Checklist */}
          <Card className="border-border bg-card/50">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Path to Activation</h3>
              </div>
              <div className="space-y-1">
                <SetupStep title="Website Crawled"   completed={hasCrawled}       icon={Globe}         href="/dashboard/configure" delay={0.2} />
                <SetupStep title="Knowledge Indexed" completed={hasChunks}        icon={Database}      href="/dashboard/configure" delay={0.3} />
                <SetupStep title="Theme Customized"  completed={true}             icon={Zap}           href="/dashboard/configure" delay={0.4} />
                <SetupStep title="First Interaction" completed={hasConversations} icon={MessageSquare} href="/dashboard/history"   delay={0.5} />
              </div>
            </CardContent>
          </Card>

          {/* ── QUOTA CARD ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">Monthly Quota</h3>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "capitalize text-[10px] font-bold border",
                      data?.plan === "pro"     ? "bg-[#36f4a4]/10 text-[#36f4a4] border-[#36f4a4]/20" :
                      data?.plan === "starter" ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                                                  "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {data?.plan || "free"} Plan
                  </Badge>
                </div>

                {/* Message Quota */}
                {msgQuota && (
                  <QuotaBar
                    label="Messages"
                    used={msgQuota.used}
                    limit={msgQuota.limit}
                    remaining={msgQuota.remaining}
                    percentUsed={msgQuota.percentUsed}
                    resetDate={msgQuota.resetDate}
                    icon={MessageSquare}
                  />
                )}

                {/* Crawl Quota */}
                {crawlQuota && (
                  <QuotaBar
                    label="Crawls"
                    used={crawlQuota.used}
                    limit={crawlQuota.limit}
                    remaining={crawlQuota.remaining}
                    percentUsed={crawlQuota.percentUsed}
                    icon={Globe}
                  />
                )}

                <Button className="w-full h-10 rounded-xl" variant="outline" asChild>
                  <Link href="/dashboard/account">
                    <Crown className="h-4 w-4 mr-2" />
                    {data?.plan === "pro" ? "Manage Subscription" : "Upgrade Plan"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <Card className="border-border bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Quick Stats</h3>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" asChild>
                  <Link href="/dashboard/analytics">View All</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Total Conversations", value: (data?.totalConversations ?? 0).toLocaleString(),  color: "text-blue-400"    },
                  { label: "Active Today",         value: (data?.activeToday ?? 0).toLocaleString(),         color: "text-[#36f4a4]"  },
                  { label: "Avg Response Time",    value: formatMs(data?.avgResponseTimeMs ?? 0),             color: "text-orange-400" },
                  { label: "Messages This Month",  value: (msgQuota?.used ?? 0).toLocaleString(),             color: "text-purple-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={cn("text-sm font-bold", color)}>{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}