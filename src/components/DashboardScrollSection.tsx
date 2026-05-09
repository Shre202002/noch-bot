"use client";

import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { BarChart3, Bot, LayoutDashboard, MessageSquare, Zap } from "lucide-react";

export function DashboardScrollSection() {
  return (
    <section className="bg-background">
      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-4">Command Center</p>
            <h2 className="text-4xl md:text-7xl font-bold text-white tracking-tight">
              Manage everything from <br />
              <span className="text-primary italic">One Dashboard</span>
            </h2>
          </div>
        }
      >
        <div className="h-full w-full bg-[#0d1117] p-4 md:p-8 flex flex-col gap-6 overflow-hidden">
          {/* Mock Dashboard Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Project: NOCHBOT Main</h3>
                <p className="text-xs text-white/40">Overview of your primary AI agent</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-medium">
                Bot Active
              </div>
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 font-medium">
                Last Crawl: 2m ago
              </div>
            </div>
          </div>

          {/* Mock Dashboard Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Messages", value: "12,402", icon: MessageSquare },
              { label: "Avg Response", value: "0.8s", icon: Zap },
              { label: "Resolved", value: "94.2%", icon: Zap },
              { label: "Knowledge", value: "1.2k pages", icon: Bot },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="h-4 w-4 text-white/40" />
                  <span className="text-[10px] text-emerald-500">+12%</span>
                </div>
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Mock Chart Area */}
          <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-sm font-medium text-white/60">Engagement Trends</h4>
              <BarChart3 className="h-4 w-4 text-white/20" />
            </div>
            <div className="flex items-end justify-between gap-2 h-32 md:h-48">
              {[40, 70, 45, 90, 65, 80, 55, 75, 50, 85, 95, 60].map((h, i) => (
                <div 
                  key={i} 
                  className="w-full bg-primary/20 rounded-t-sm transition-all duration-500 group-hover:bg-primary/40"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Mock Recent Activity */}
          <div className="space-y-3">
             <div className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Recent Inquiries</div>
             {[
               "How do I reset my password?",
               "Can you show me the pricing options?",
               "What is the refund policy?",
             ].map((text, i) => (
               <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                 <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(153,153,204,0.5)]" />
                 <span className="text-xs text-white/60">{text}</span>
                 <span className="ml-auto text-[10px] text-white/20">Just now</span>
               </div>
             ))}
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
