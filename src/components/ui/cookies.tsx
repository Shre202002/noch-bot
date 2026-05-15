'use client';

import React from "react";
import { cn } from "@/lib/utils";
import { Cookie } from "lucide-react";

interface CookieConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function CookieConsentBanner({ onAccept, onDecline }: CookieConsentProps) {
  return (
    <div className="fixed bottom-6 left-6 z-[100] animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="flex flex-col w-80 sm:w-96 bg-card text-muted-foreground p-6 rounded-2xl border border-border shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 pb-4">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-foreground text-lg font-bold tracking-tight">Your privacy matters</h2>
        </div>
        <p className="text-xs leading-relaxed">
          We use cookies to improve your experience, analyze traffic, and support our marketing efforts. 
          By accepting, you agree to our <a href="/privacy" className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors">Privacy Policy</a>.
        </p>
        <div className="flex items-center justify-between mt-6 gap-3 w-full">
          <button 
            type="button" 
            onClick={onDecline}
            className="text-xs font-semibold hover:text-foreground transition-colors cursor-pointer"
          >
            Decline
          </button>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onAccept}
              className="bg-primary px-6 py-2 rounded-full text-primary-foreground text-xs font-bold active:scale-95 transition-all hover:opacity-90 cursor-pointer"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
