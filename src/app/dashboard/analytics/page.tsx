
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Users,
  Zap,
  Clock,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Globe,
  Activity,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Bot,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

// --- Mock Data & Config ---

const CHART_DATA = [
  { day: "Mon", messages: 240, users: 120 },
  { day: "Tue", messages: 450, users: 190 },
  { day: "Wed", messages: 380, users: 160 },
  { day: "Thu", messages: 520, users: 240 },
  { day: "Fri", messages: 890, users: 410 },
  { day: "Sat", messages: 760, users: 320 },
  { day: "Sun", messages: 920, users: 450 },
];

const chartConfig = {
  messages: {
    label: "Messages",
    color: "hsl(var(--primary))",
  },
  users: {
    label: "Users",
    color: "oklch(0.6 0.22 264)",
  },
} satisfies ChartConfig;

const TOP_QUESTIONS = [
  { text: "What are your pricing plans?", count: 142, growth: "+12%" },
  { text: "How do I install the script?", count: 98, growth: "+5%" },
  { text: "Do you support custom domains?", count: 76, growth: "+22%" },
  { text: "Can I use GPT-4 models?", count: 64, growth: "+8%" },
  { text: "Where is my data stored?", count: 42, growth: "-3%" },
];

const RECENT_ACTIVITY = [
  { type: "Crawl", title: "Crawl Completed", desc: "Indexed 12 new pages from nocta.ai/docs", time: "2m ago", status: "success" },
  { type: "Theme", title: "Theme Updated", desc: "Updated primary accent to Emerald Green", time: "1h ago", status: "neutral" },
  { type: "Chat", title: "High Volume Alert", desc: "Conversations increased by 40% in last hour", time: "3h ago", status: "warning" },
  { type: "Embed", title: "Script Verified", desc: "Live traffic detected on production-domain.com", time: "5h ago", status: "success" },
];

// --- Reusable Components ---

const KPICard = ({ title, value, label, icon: Icon, trend, trendValue, color, delay }: any) => {
  const isPositive = trend === "up";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="group relative overflow-hidden border-border bg-card/40 backdrop-blur-md transition-all hover:bg-card/60">
        <div className={cn(
          "absolute top-0 right-0 p-6 opacity-5 transition-transform duration-500 group-hover:scale-125",
          color === "primary" ? "text-primary" : "text-muted-foreground"
        )}>
          <Icon className="h-16 w-16" />
        </div>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              "p-2.5 rounded-xl border transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]",
              color === "primary" ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border text-muted-foreground"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className={cn(
              "flex items-center gap-1 text-xs font-bold",
              isPositive ? "text-[#36f4a4]" : "text-destructive"
            )}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trendValue}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-black tracking-tight text-foreground">{value}</h3>
            <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ActivityItem = ({ title, desc, time, status, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    whileInView={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    viewport={{ once: true }}
    className="relative pl-8 pb-8 last:pb-0"
  >
    <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border last:hidden" />
    <div className={cn(
      "absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 border-[#0a0a0a] z-10 flex items-center justify-center",
      status === "success" ? "bg-[#36f4a4]" : status === "warning" ? "bg-yellow-500" : "bg-primary/40"
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

// --- Main Page Component ---

export default function AnalyticsPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      
      {/* SECTION 1 — HERO HEADER */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-[#36f4a4] animate-pulse" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-[#36f4a4]/40 animate-ping" />
            </div>
            <span className="text-xs font-bold text-[#36f4a4] uppercase tracking-[0.2em]">Live Analytics</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Intelligence.</h1>
          <p className="text-muted-foreground max-w-md">
            Measure the quality of your AI conversations and monitor RAG performance in real-time.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full bg-background/50 border-border hover:bg-accent transition-all">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 Days
          </Button>
          <Button className="rounded-full bg-white text-black hover:opacity-90 transition-opacity font-bold">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </section>

      {/* SECTION 2 — KPI GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Conversations" 
          value="4,204" 
          label="Unique visitors engaged" 
          icon={MessageSquare} 
          trend="up"
          trendValue="24%"
          color="primary"
          delay={0.1}
        />
        <KPICard 
          title="Messages Sent" 
          value="12,402" 
          label="Total LLM responses" 
          icon={Zap} 
          trend="up"
          trendValue="18%"
          color="muted"
          delay={0.2}
        />
        <KPICard 
          title="Avg Response" 
          value="0.82s" 
          label="End-to-end latency" 
          icon={Clock} 
          trend="down"
          trendValue="4%"
          color="muted"
          delay={0.3}
        />
        <KPICard 
          title="Active Visitors" 
          value="158" 
          label="Currently online" 
          icon={Users} 
          trend="up"
          trendValue="12%"
          color="muted"
          delay={0.4}
        />
      </section>

      {/* SECTION 3 — MAIN CHART & TOP QUESTIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        <Card className="xl:col-span-2 border-border bg-card/30 backdrop-blur-xl overflow-hidden group">
          <CardHeader className="p-6 border-b border-border flex flex-row items-center justify-between bg-accent/5">
            <div>
              <CardTitle className="text-sm font-bold">Engagement Trends</CardTitle>
              <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Message & User Volume</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-6 pt-10">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.6 0.22 264)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.6 0.22 264)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="messages" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorMessages)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="oklch(0.6 0.22 264)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorUsers)" 
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-bold">Top User Inquiries</CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Most asked prompts</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {TOP_QUESTIONS.map((q, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="group flex flex-col gap-2 p-3 rounded-xl border border-transparent hover:border-border hover:bg-accent/20 transition-all cursor-default"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-medium text-foreground leading-relaxed max-w-[200px]">{q.text}</p>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {q.count}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-accent rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(q.count / 150) * 100}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-primary">{q.growth}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-xs text-muted-foreground hover:text-foreground">
              View Detailed Prompts <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4 — BOT HEALTH & ENGAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-bold">Operational Health</CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">System readiness indicators</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Vector Database</p>
                  <p className="text-[10px] text-muted-foreground">Qdrant Cloud • Cluster Alpha</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-muted-foreground">Sync Health</span>
                  <span className="text-emerald-500">99.9%</span>
                </div>
                <Progress value={99} className="h-1 bg-accent" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Knowledge Base</p>
                  <p className="text-[10px] text-muted-foreground">1,248 Chunks Indexed</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-muted-foreground">Storage Capacity</span>
                  <span className="text-blue-500">24.2%</span>
                </div>
                <Progress value={24} className="h-1 bg-accent" />
              </div>
            </div>

            <div className="sm:col-span-2 pt-4 border-t border-border mt-2 grid grid-cols-2 gap-4">
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Last Crawl</p>
                 <p className="text-xs font-semibold">Today, 11:42 AM</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Crawl Efficiency</p>
                 <p className="text-xs font-semibold">15 Pages / 8.2s</p>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-bold">Recent Platform Activity</CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Audit logs & events</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative">
              {RECENT_ACTIVITY.map((activity, i) => (
                <ActivityItem 
                  key={i}
                  title={activity.title}
                  desc={activity.desc}
                  time={activity.time}
                  status={activity.status}
                  delay={0.1 * i}
                />
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground">
              Download Full Logs <Download className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
