"use client";

import * as React from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SigninModal from "./signin-modal";
import SignupModal from "./signup-modal";

// Anchors point at the homepage so they also work from inner pages.
const navItems = [
  { name: "Features", href: "/#features" },
  { name: "Process", href: "/#process" },
  { name: "Pricing", href: "/#pricing" },
];

// Shown beside the anchors from md up; always listed in the phone menu.
const extraItems = [
  { name: "Blog", href: "/blog" },
  { name: "Tools", href: "/tools" },
  { name: "Docs", href: "/docs" },
];

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring", damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring",
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "3rem",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const logoVariants = {
  expanded: { opacity: 1, x: 0, rotate: 0, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -25, rotate: -180, transition: { duration: 0.3 } },
};

const itemVariants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const collapsedIconVariants = {
    expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
    collapsed: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 300,
        delay: 0.15,
      }
    },
}

export function AnimatedNavFramer() {
  const [isExpanded, setExpanded] = React.useState(true);
  
  const { scrollY } = useScroll();
  const lastScrollY = React.useRef(0);
  const scrollPositionOnCollapse = React.useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    
    // Collapse when scrolling down
    if (isExpanded && latest > previous && latest > 150) {
      setExpanded(false);
      scrollPositionOnCollapse.current = latest; 
    } 
    // Expand when scrolling up significantly
    else if (!isExpanded && latest < previous && (scrollPositionOnCollapse.current - latest > EXPAND_SCROLL_THRESHOLD)) {
      setExpanded(true);
    }
    
    lastScrollY.current = latest;
  });

  const handleNavClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
    }
  };


  return (
    <>
    <MobileNav />
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full hidden sm:flex justify-center px-4">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        whileHover={!isExpanded ? { scale: 1.1 } : {}}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        onClick={handleNavClick}
        className={cn(
          "flex items-center overflow-hidden rounded-full border bg-background/80 shadow-lg backdrop-blur-sm h-12 max-w-full transition-all duration-300",
          !isExpanded && "cursor-pointer justify-center"
        )}
      >
        <motion.div
          variants={logoVariants}
          className="flex-shrink-0 flex items-center font-semibold pl-4 pr-1 sm:pr-3"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)] blur-md" />
            <a href="/" aria-label="NochBot home" onClick={(e) => e.stopPropagation()} className="relative z-10">
              <img src="/brand/nochbot-logo.webp" alt="NochBot" width={192} height={128} decoding="async" className="h-10 w-auto" />
            </a>
          </div>
        </motion.div>
        
        <motion.div
          className={cn(
            "flex items-center gap-0.5 sm:gap-4 pr-4 sm:pr-6",
            !isExpanded && "pointer-events-none" 
          )}
        >
          {navItems.map((item) => (
            <motion.a
              key={item.name}
              href={item.href}
              variants={itemVariants}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-foreground px-1.5 sm:px-2 py-1 whitespace-nowrap"
            >
              {item.name}
            </motion.a>
          ))}

          {extraItems.map((item) => (
            <motion.a
              key={item.name}
              href={item.href}
              variants={itemVariants}
              onClick={(e) => e.stopPropagation()}
              className="hidden md:inline text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-1 whitespace-nowrap"
            >
              {item.name}
            </motion.a>
          ))}
          
          <motion.div variants={itemVariants} onClick={(e) => e.stopPropagation()}>
            <SigninModal trigger={
              <button className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-foreground px-1.5 sm:px-2 py-1 whitespace-nowrap cursor-pointer">
                Sign in
              </button>
            } />
          </motion.div>

          <motion.div variants={itemVariants} onClick={(e) => e.stopPropagation()} className="ml-1">
             <SignupModal trigger={
               <button className="text-[10px] sm:text-sm font-bold text-white bg-primary/20 hover:bg-primary/30 border border-primary/20 rounded-full px-3 py-1 whitespace-nowrap cursor-pointer">
                 Try NochBot
               </button>
             } />
          </motion.div>
        </motion.div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            variants={collapsedIconVariants}
            animate={isExpanded ? "expanded" : "collapsed"}
          >
            <Menu className="h-6 w-6" />
          </motion.div>
        </div>
      </motion.nav>
    </div>
    </>
  );
}

/** Phone header: logo plus a hamburger that opens the page links and sign-in / sign-up. */
function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="sm:hidden fixed top-0 inset-x-0 z-50">
      <div className="flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-sm border-b">
        <a href="/" aria-label="NochBot home">
          <img src="/brand/nochbot-logo.webp" alt="NochBot" width={192} height={128} decoding="async" className="h-9 w-auto" />
        </a>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="h-10 w-10 flex items-center justify-center rounded-md"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 px-4 py-3 bg-background/95 backdrop-blur-sm border-b shadow-lg">
          {navItems.map((item) => (
            <a key={item.name} href={item.href} onClick={close} className="py-3 text-base font-medium text-muted-foreground hover:text-foreground">
              {item.name}
            </a>
          ))}
          {extraItems.map((item) => (
            <a key={item.name} href={item.href} onClick={close} className="py-3 text-base font-medium text-muted-foreground hover:text-foreground">
              {item.name}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <SigninModal trigger={
              <button type="button" className="flex-1 py-2.5 text-sm font-medium border rounded-full cursor-pointer">Sign in</button>
            } />
            <SignupModal trigger={
              <button type="button" className="flex-1 py-2.5 text-sm font-bold text-white bg-primary/30 border border-primary/20 rounded-full cursor-pointer">Try NochBot</button>
            } />
          </div>
        </div>
      )}
    </div>
  );
}
