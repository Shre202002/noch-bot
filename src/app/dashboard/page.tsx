"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Bot, Code2, Globe, MessageSquare, TrendingUp, Zap, Activity, Package } from "lucide-react";
import Link from "next/link";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor your AI agent's performance and usage metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Messages" 
          value="12,402" 
          change="+12% from last month" 
          icon={MessageSquare} 
          color="blue"
        />
        <StatCard 
          title="Active Bots" 
          value="3" 
          change="+1 new this week" 
          icon={Bot} 
          color="green"
        />
        <StatCard 
          title="Resolution Rate" 
          value="94.2%" 
          change="+2.4% from last week" 
          icon={Zap} 
          color="purple"
        />
        <StatCard 
          title="Knowledge Pages" 
          value="1,248" 
          change="Last crawl: 2m ago" 
          icon={Globe} 
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest interactions and system events.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/analytics">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <ActivityItem 
                  icon={MessageSquare} 
                  title="New conversation started" 
                  desc="User inquired about pricing plans" 
                  time="2 min ago" 
                  color="blue"
                />
                <ActivityItem 
                  icon={Zap} 
                  title="Resolution achieved" 
                  desc="Bot successfully handled 'Refund' query" 
                  time="15 min ago" 
                  color="purple"
                />
                <ActivityItem 
                  icon={Globe} 
                  title="Crawl completed" 
                  desc="nocta.ai documentation fully indexed" 
                  time="1 hour ago" 
                  color="orange"
                />
                <ActivityItem 
                  icon={Activity} 
                  title="System maintenance" 
                  desc="Vector database optimization complete" 
                  time="3 hours ago" 
                  color="green"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Jump to frequently used configuration tools.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
               <QuickAction 
                 title="Configure Persona" 
                 desc="Adjust bot voice and visuals" 
                 icon={Bot} 
                 href="/dashboard/configure" 
               />
               <QuickAction 
                 title="Get Embed Code" 
                 desc="Add Nocta to your website" 
                 icon={Code2} 
                 href="/dashboard/embed" 
               />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Usage Limits</CardTitle>
              <CardDescription>Current cycle tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Messages (12k / 50k)</span>
                  <span className="font-bold">24%</span>
                </div>
                <div className="w-full bg-accent rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '24%' }}></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Knowledge Base (1.2k / 5k)</span>
                  <span className="font-bold">24%</span>
                </div>
                <div className="w-full bg-accent rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '24%' }}></div>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline">Upgrade Plan</Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm overflow-hidden">
             <div className="p-6 bg-primary/5 border-b border-border">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-sm font-semibold">Systems Operational</span>
                </div>
             </div>
             <CardContent className="p-6">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All AI agents are currently responding within the 1s latency SLA.
                </p>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, color }: any) {
  const colorClasses: any = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl border ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <TrendingUp className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-2 font-medium">{change}</p>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, desc, time, color }: any) {
  const colorClasses: any = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
  };

  return (
    <div className="flex items-center space-x-4 p-3 rounded-xl hover:bg-accent transition-colors cursor-pointer group">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
        {time}
      </div>
    </div>
  );
}

function QuickAction({ title, desc, icon: Icon, href }: any) {
  return (
    <Link href={href} className="flex flex-col p-4 rounded-xl border border-border bg-accent/30 hover:bg-accent hover:border-primary/30 transition-all group">
      <Icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
      <h4 className="text-sm font-bold">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </Link>
  );
}
