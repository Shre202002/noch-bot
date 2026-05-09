'use client';

import * as React from "react";
import { useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, Zap, Layout, Users, CreditCard, LogIn } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";

interface MenuItem {
  id: number;
  title: string;
  url: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    id: 1,
    title: "Product",
    url: "#features",
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 2,
    title: "Company",
    url: "#workflow",
    icon: <Users className="w-4 h-4" />
  },
  {
    id: 3,
    title: "Pricing",
    url: "#pricing",
    icon: <CreditCard className="w-4 h-4" />
  }
];

export function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 100);
  });

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuVariants = {
    closed: {
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05,
        staggerDirection: -1
      }
    },
    open: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    closed: { y: 10, opacity: 0 },
    open: { y: 0, opacity: 1 }
  };

  return (
    <>
      {/* Primary Desktop Navbar (Top only) */}
      <motion.nav
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: isScrolled ? -100 : 0,
          opacity: isScrolled ? 0 : 1
        }}
        className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/50 backdrop-blur-xl border-b border-white/5"
      >
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo />
            <span className="text-[18px] font-bold tracking-[-0.03em] text-white uppercase group-hover:opacity-80 transition-opacity">
              NOCHBOT
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              <Link 
                key={item.id} 
                href={item.url}
                className="text-[13px] text-white/40 transition-colors hover:text-white flex items-center gap-2"
              >
                {item.title}
              </Link>
            ))}
            <Link 
              href="/login"
              className="text-[13px] text-white/40 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link 
              href="/register" 
              className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#080b10] hover:opacity-90 transition-opacity"
            >
              Try NochBot
            </Link>
          </div>

          {/* Mobile simple trigger (for top state) */}
          <div className="md:hidden">
            <button onClick={toggleMenu} className="text-white/60 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Floating Action Menu Trigger (Visible on scroll) */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 45 }}
            className="fixed top-6 right-6 z-[60]"
          >
            <button
              onClick={toggleMenu}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl hover:scale-110 transition-transform active:scale-95"
            >
              <AnimatePresence mode="wait">
                {isMenuOpen ? (
                  <motion.div key="close" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }}>
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90 }} animate={{ rotate: 0 }} exit={{ rotate: -90 }}>
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Overlay Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleMenu}
              className="fixed inset-0 z-[55] bg-background/80 backdrop-blur-md"
            />

            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed inset-0 z-[56] flex items-center justify-center p-6 pointer-events-none"
            >
              <div className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-8 shadow-2xl pointer-events-auto">
                <div className="mb-8 flex flex-col items-center gap-2">
                  <Logo />
                  <span className="text-sm font-bold tracking-widest text-white/40 uppercase">NOCHBOT Menu</span>
                </div>

                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <motion.div key={item.id} variants={itemVariants}>
                      <Link
                        href={item.url}
                        onClick={toggleMenu}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors group"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <span className="text-lg font-medium text-white">{item.title}</span>
                      </Link>
                    </motion.div>
                  ))}
                  
                  <motion.div variants={itemVariants} className="pt-4 grid grid-cols-2 gap-3">
                    <Link
                      href="/login"
                      onClick={toggleMenu}
                      className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={toggleMenu}
                      className="flex items-center justify-center p-4 rounded-2xl bg-white text-black font-bold"
                    >
                      Join Free
                    </Link>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}