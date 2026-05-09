
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * @fileOverview A premium newsletter popup for NOCTA.
 * Now a controlled component triggered by specific user actions.
 */

interface NewsletterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewsletterPopup({ isOpen, onClose }: NewsletterPopupProps) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (email && email.includes("@")) {
      setSubscribed(true);
      setTimeout(() => {
        onClose();
        // Reset state for next time it's opened
        setTimeout(() => setSubscribed(false), 500);
      }, 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-6 md:items-center">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#161b22] p-8 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-white/20 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {!subscribed ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">Join the Network</h3>
                    <p className="text-xs text-white/40">The future of AI agents, delivered.</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-white/60">
                  Join 2,000+ developers getting early access to NOCHBOT feature drops, embedding techniques, and agentic workflows.
                </p>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 border-white/5 bg-black/20 text-sm focus-visible:ring-primary"
                  />
                  <Button
                    onClick={handleSubscribe}
                    className="h-10 bg-white text-black hover:opacity-90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-[10px] text-center text-white/20">
                  No spam. Just engineering excellence. Unsubscribe any time.
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <Send className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-medium text-white">You're in.</h3>
                <p className="mt-2 text-sm text-white/40">Check your inbox for a welcome gift.</p>
              </motion.div>
            )}
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-sm"
          />
        </div>
      )}
    </AnimatePresence>
  );
}
