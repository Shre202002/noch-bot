'use client';

import { motion } from 'framer-motion';
import { CommitsGrid } from './ui/commits-grid';
import { Github } from 'lucide-react';

export function GitHubActivity() {
  return (
    <section className="w-full py-24 bg-background px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-4">Activity</p>
          <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-white mb-6">
            Building in <span className="text-[#36f4a4] italic">Public</span>
          </h2>
          <p className="text-white/40 max-w-xl text-sm md:text-base">
            A real-time visualization of the NochBot core infrastructure contributions and build state.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-6 w-full">
             <div className="flex items-center gap-3 mb-2">
                <Github className="h-5 w-5 text-white/60" />
                <span className="text-sm font-semibold text-white/60 tracking-wider uppercase">Contribution Graph</span>
             </div>
             
             <div className="w-full flex justify-center">
                <CommitsGrid text="NOCHBOT" />
             </div>
             
             <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[2px] bg-card border" />
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">Less</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-[2px] bg-[#0d4429]" />
                  <div className="w-3 h-3 rounded-[2px] bg-[#016d32]" />
                  <div className="w-3 h-3 rounded-[2px] bg-[#48d55d]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">More</span>
                </div>
             </div>
             
             <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">Spelling: N O C H B O T</p>
          </div>
        </div>
      </div>
    </section>
  );
}
