"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Database, Globe, Activity,
  TrendingUp, Clock, Users, Zap,
  Smartphone, Monitor, Tablet, ArrowUpRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
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
      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">{new Date(label).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
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
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#36f4a4] border-t-transparent animate-spin" />
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

  const formatMs = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  const totalDevices = Object.values(data.deviceBreakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-black tracking-tight">
            Intelligence
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-sm mt-1">
            Real-time performance metrics for <span className="text-foreground font-medium">{data.botName}</span>
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[#36f4a4] border-[#36f4a4]/30 bg-[#36f4a4]/5 px-4 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[#36f4a4] mr-2 animate-pulse" />
            Live Monitoring
          </Badge>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Conversations" value={data.totalConversations.toLocaleString()} label={`${data.recentConversations} new this week`} icon={MessageSquare} color="blue" delay={0.1} />
        <StatCard title="Messages" value={data.totalMessages.toLocaleString()} label={`${data.avgMessagesPerConversation} avg per chat`} icon={TrendingUp} color="purple" delay={0.2} />
        <StatCard title="Latency" value={formatMs(data.avgResponseTimeMs)} label="Avg response generation" icon={Clock} color="orange" delay={0.3} />
        <StatCard title="Active Sessions" value={data.activeToday.toLocaleString()} label="Unique visitors today" icon={Users} color="green" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Messages Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-2">
          <Card className="border-border bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Engagement Activity</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Volume — Last 7 Days</p>
                </div>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-10">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.messagesLast7Days}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#36f4a4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#36f4a4" stopOpacity={0}/>
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
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#36f4a4', strokeWidth: 1 }} />
                    <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#36f4a4" 
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

        {/* Right Column */}
        <div className="space-y-6">

          {/* Device Distribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-border bg-card/50">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Visitor Devices</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Desktop', key: 'desktop', icon: Monitor },
                    { label: 'Mobile', key: 'mobile', icon: Smartphone },
                    { label: 'Tablet', key: 'tablet', icon: Tablet },
                  ].map((device) => {
                    const count = data.deviceBreakdown[device.key] || 0;
                    const pct = Math.round((count / totalDevices) * 100);
                    return (
                      <div key={device.key} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <device.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-foreground">{device.label}</span>
                          </div>
                          <span className="font-black">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-accent/30 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${pct}%` }} 
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full bg-primary rounded-full" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Websites Breakdown */}
          {data.conversationsByWebsite.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="border-border bg-card/50">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Top Domains</h3>
                  <div className="space-y-3">
                    {data.conversationsByWebsite.map((w, i) => {
                      const max = data.conversationsByWebsite[0].count;
                      const pct = Math.round((w.count / max) * 100);
                      return (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                                {i+1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-foreground font-medium truncate">{w.website}</span>
                                    <span className="text-muted-foreground">{w.count} chats</span>
                                </div>
                                <div className="h-1 bg-accent/30 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#36f4a4]/40" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Top Questions */}
      {data.topQuestions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="font-bold text-sm flex items-center gap-2">
                   <Zap className="h-4 w-4 text-[#36f4a4]" />
                   Frequent Inquiries
                 </h3>
                 <Badge variant="outline" className="text-[10px] text-muted-foreground">Intelligence Insights</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.topQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-accent/10 border border-border/50 hover:border-primary/30 transition-colors">
                    <span className="text-xs font-black text-muted-foreground/40 w-6 shrink-0 mt-0.5">#{i + 1}</span>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm text-foreground font-medium leading-relaxed italic">"{q.question}"</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Asked {q.count} times</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
