"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Database, Globe, Activity,
  TrendingUp, Clock, Users, Zap,
  Smartphone, Monitor, Tablet, ArrowUpRight,
  ShieldCheck, MousePointer2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  avgResponseTimeMs: number;
  activeToday: number;
  recentConversations: number;
  chunksIndexed: number;
  lastCrawl: string | null;
  botName: string;
  websiteUrl: string;
  messagesLast7Days: { date: string; count: number }[];
  topQuestions: { question: string; count: number }[];
  conversationsByWebsite: { website: string; count: number }[];
  deviceBreakdown: Record<string, number>;
  // New behavioral analytics fields
  totalEvents: number;
  topEvents: { name: string; count: number }[];
  funnel: Record<string, number>;
}

const StatCard = ({ title, value, label, icon: Icon, color, delay }: any) => {
  const colorMap: Record<string, string> = {
    green: "text-[#36f4a4] bg-[#36f4a4]/10 border-[#36f4a4]/20",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    orange: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="border-border bg-card/50 hover:bg-card transition-colors group">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colorMap[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-3xl font-black text-foreground">{value}</h3>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-[#36f4a4]" />
            {label}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111111] border border-border rounded-xl p-3 shadow-2xl backdrop-blur-md">
      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#36f4a4]" />
        <p className="text-foreground font-bold text-sm">{payload[0].value} messages</p>
      </div>
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);



  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data || (data as any).error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-foreground font-bold">No analytics data yet</p>
          <p className="text-muted-foreground text-sm max-w-xs">Start chatting on your website to generate insights and track bot performance.</p>
        </div>
      </div>
    );
  }

  const totalEvents = data.totalEvents ?? 0;
  const topEvents = data.topEvents ?? [];
  const funnel = data.funnel ?? {};
  const topQuestions = data.topQuestions ?? [];
  const deviceBreakdown = data.deviceBreakdown ?? {};
  const messagesLast7Days = data.messagesLast7Days ?? [];
  const formatMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  const totalDevices = Object.values(data.deviceBreakdown).reduce((a, b) => a + b, 0) || 1;

  // Funnel steps mapping
  const funnelData = [
    { name: "Crawl Started", value: funnel?.crawl_started || 0 },
    { name: "Crawl Done", value: funnel?.crawl_completed || 0 },
    { name: "First Chat", value: data.totalConversations || 0 },
  ];

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-black tracking-tight">
            Intelligence
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-sm mt-1">
            Real-time behavioral insights for <span className="text-foreground font-medium">{data.botName}</span>
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 px-4 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse" />
            Live Data Feed
          </Badge>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Conversations" value={data.totalConversations.toLocaleString()} label={`${data.recentConversations} new this week`} icon={MessageSquare} color="blue" delay={0.1} />
        <StatCard title="Total Activity" value={(totalEvents ?? 0).toLocaleString()} label="User interactions" icon={MousePointer2} color="purple" delay={0.2} />
        <StatCard title="Latency" value={formatMs(data.avgResponseTimeMs)} label="Avg AI generation" icon={Clock} color="orange" delay={0.3} />
        <StatCard title="Active Sessions" value={data.activeToday.toLocaleString()} label="Unique visitors today" icon={Users} color="green" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Engagement Activity Area Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-2">
          <Card className="border-border bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Engagement Activity</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Message Volume — Last 7 Days</p>
                </div>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-10">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={messagesLast7Days}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="white" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="white" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#666' }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'white', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="white"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Behavioral Summary Bar Chart */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-border bg-card/50 overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <h3 className="font-bold text-sm text-white uppercase tracking-widest">Behavioral Top Events</h3>
                <div className="space-y-4">
                  {topEvents.slice(0, 5).map((event, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground truncate">{event.name.replace(/_/g, ' ')}</span>
                        <span className="font-black text-white">{event.count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round((event.count / topEvents[0].count) * 100)}%` }}
                          className="h-full bg-white rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Funnel Visual */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="border-border bg-card/50">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-sm text-white uppercase tracking-widest">Activation Funnel</h3>
                <div className="flex flex-col gap-3">
                  {funnelData.map((step, i) => {
                    const pct = Math.round((step.value / (funnelData[0].value || 1)) * 100);
                    return (
                      <div key={i} className="relative p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="z-10 flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Step {i + 1}</span>
                          <span className="text-xs font-medium text-white">{step.name}</span>
                        </div>
                        <div className="z-10 text-right">
                          <span className="text-sm font-black text-white">{step.value}</span>
                          <span className="text-[9px] text-muted-foreground block">{pct}%</span>
                        </div>
                        <div className="absolute inset-y-0 left-0 bg-white/5 rounded-l-xl transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Bottom Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Distribution */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm mb-8 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-400" />
              Visitor Ecosystem
            </h3>
            <div className="grid grid-cols-3 gap-8">
              {[
                { label: 'Desktop', key: 'desktop', icon: Monitor },
                { label: 'Mobile', key: 'mobile', icon: Smartphone },
                { label: 'Tablet', key: 'tablet', icon: Tablet },
              ].map((device) => {
                const count = deviceBreakdown[device.key] || 0;
                const pct = Math.round((count / totalDevices) * 100);
                return (
                  <div key={device.key} className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      <device.icon className="h-6 w-6 text-white/40" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{device.label}</p>
                      <p className="text-lg font-black text-white">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Questions */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm mb-6 flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-400" />
              Top Intent Extraction
            </h3>
            <div className="space-y-2">
              {topQuestions.slice(0, 4).map((q, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  <span className="text-xs text-white/60 truncate italic flex-1 pr-4">"{q.question}"</span>
                  <Badge variant="secondary" className="bg-white/10 text-white border-0 text-[10px]">{q.count} times</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
