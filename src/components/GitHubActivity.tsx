'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CommitsGrid } from './ui/commits-grid';
import { Github, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function GitHubActivity() {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/github-commits')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCommits(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section className="w-full py-24 bg-background px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-4">Activity</p>
          <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-white mb-6">
            Building in <span className="text-[#36f4a4] italic">Public</span>
          </h2>
          <p className="text-white/40 max-w-xl text-sm md:text-base">
            Track real-time development progress and contributions to the NochBot core infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6 items-center lg:items-start order-2 lg:order-1">
             <div className="flex items-center gap-3 mb-2">
                <Github className="h-5 w-5 text-white/60" />
                <span className="text-sm font-semibold text-white/60 tracking-wider uppercase">Contribution Graph</span>
             </div>
             <CommitsGrid text="NOCHBOT" />
             <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">Visualization of current build state</p>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Latest Commits</h3>
                <a 
                  href="https://github.com/Shre202002/noch-bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-[#36f4a4] hover:underline flex items-center gap-1"
                >
                  View Repo <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <div className="space-y-3">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 w-full rounded-xl bg-white/5 animate-pulse border border-white/5" />
                ))
              ) : commits.length > 0 ? (
                commits.slice(0, 5).map((commit, i) => (
                  <motion.div
                    key={commit.sha}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 rounded-full bg-[#36f4a4] shadow-[0_0_8px_rgba(54,244,164,0.5)]" />
                          <span className="font-mono text-[11px] text-[#36f4a4] font-bold">{commit.sha}</span>
                        </div>
                        <p className="text-sm text-white/80 line-clamp-1 group-hover:text-white transition-colors">
                          {commit.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/30 whitespace-nowrap pt-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-sm text-white/20 text-center py-8">No commits found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}