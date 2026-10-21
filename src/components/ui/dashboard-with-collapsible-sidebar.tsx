"use client"
import React, { useState, useEffect } from "react";
import {
  Home,
  MessageSquare,
  Bot,
  BarChart3,
  ChevronRight,
  ChevronsRight,
  Moon,
  Sun,
  TrendingUp,
  Bell,
  Settings,
  User,
  LogOut,
  Code2,
  FileText,
  Calendar,
  CalendarPlus,
  Ticket,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoIcon, Wordmark } from "@/components/logo";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PopoverFooter,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  notifs?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Every destination lives in exactly one group, so the rail never shows a long flat list:
// related pages (analytics pair, events pair, bot + embed + knowledge) stay together.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    items: [
      { icon: Home, title: "Dashboard", href: "/dashboard" },
      { icon: MessageSquare, title: "Chat History", href: "/dashboard/history", notifs: 4 },
    ],
  },
  {
    label: "Assistant",
    items: [
      { icon: Bot, title: "Bot Config", href: "/dashboard/configure" },
      { icon: Code2, title: "Embed Codes", href: "/dashboard/embed" },
      { icon: FileText, title: "PDF Documents", href: "/dashboard/pdf" },
    ],
  },
  {
    label: "Events",
    items: [
      { icon: Calendar, title: "All Events", href: "/dashboard/events" },
      { icon: CalendarPlus, title: "New Event", href: "/dashboard/events/new" },
      { icon: Ticket, title: "Bookings", href: "/dashboard/bookings" },
    ],
  },
  {
    label: "Insights",
    items: [
      { icon: BarChart3, title: "Website Analytics", href: "/dashboard/analytics" },
      { icon: TrendingUp, title: "PDF Analytics", href: "/dashboard/pdf-analytics" },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { icon: User, title: "Account", href: "/dashboard/account" },
];

const matches = (pathname: string | null, href: string) =>
  href === "/dashboard" ? pathname === href : pathname === href || !!pathname?.startsWith(`${href}/`);

// Overview is the dashboard root, so only an exact match selects it; other sections stay selected on their
// sub-pages, except where a more specific link exists ("New Event" rather than "All Events" on /events/new).
const isActive = (pathname: string | null, href: string) =>
  matches(pathname, href) &&
  !NAV_GROUPS.flatMap((group) => group.items).some(
    (item) => item.href.length > href.length && item.href.startsWith(href) && matches(pathname, item.href)
  );

const useLogout = () => {
  const router = useRouter();
  return async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };
};

export const NoctaDashboard = ({ children, user }: { children?: React.ReactNode, user?: any }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className={`flex min-h-screen w-full ${isDark ? 'dark' : ''}`}>
      <div className="flex w-full bg-background text-foreground">
        <Sidebar user={user} />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <DashboardHeader isDark={isDark} setIsDark={setIsDark} user={user} />
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const Sidebar = ({ user }: { user?: any }) => {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const handleLogout = useLogout();

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r border-border transition-all duration-300 ease-in-out hidden md:flex flex-col ${open ? 'md:w-56 lg:w-64' : 'w-20'
        } bg-card p-3 lg:p-4 shadow-sm z-50 [@media(max-height:760px)]:p-2`}
    >
      <TitleSection open={open} user={user} />

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <NavGroups pathname={pathname} open={open} />
      </div>

      <div className="border-t border-border pt-2 space-y-1 mt-2">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarOption
            key={item.href}
            Icon={item.icon}
            title={item.title}
            href={item.href}
            selected={pathname === item.href}
            open={open}
            compact
          />
        ))}
        <button
          onClick={handleLogout}
          aria-label={open ? undefined : "Logout"}
          className={`flex h-9 w-full items-center rounded-lg transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group cursor-pointer`}
        >
          <div className="grid h-full w-10 place-content-center">
            <LogOut className="h-4 w-4" />
          </div>
          {open && <span className="text-[13px] font-medium">Logout</span>}
        </button>
      </div>

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

// Shared by the desktop rail and the mobile drawer so both always show the same grouping.
// Groups collapse individually; the group holding the current route is always expanded.
export const NavGroups = ({ pathname, open }: { pathname: string | null; open: boolean }) => {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const toggle = (label: string) =>
    setCollapsed((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  return (
    <div className="space-y-1 py-1 [@media(max-height:760px)]:space-y-0">
      {NAV_GROUPS.map((group) => {
        const hasActive = group.items.some((item) => isActive(pathname, item.href));
        // The group holding the current route can never be collapsed, so the active item stays visible.
        // In rail mode (open === false) group collapse is ignored so every icon stays reachable.
        const expanded = !open || !collapsed.includes(group.label) || hasActive;

        return (
          <div key={group.label} className="pb-1">
            {open ? (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={open && expanded}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className={hasActive ? "text-primary/80" : undefined}>{group.label}</span>
                <ChevronRight
                  className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : (
              <div className="mx-auto my-2 h-px w-6 bg-border" aria-hidden="true" />
            )}

            {expanded && (
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarOption
                    key={item.href}
                    Icon={item.icon}
                    title={item.title}
                    href={item.href}
                    selected={isActive(pathname, item.href)}
                    open={open}
                    notifs={item.notifs}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SidebarOption = ({ Icon, title, href, selected, open, notifs, compact }: any) => {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      aria-label={open ? undefined : title}
      title={open ? undefined : title}
      className={`relative flex w-full items-center transition-all duration-200 ${compact ? 'h-9 rounded-lg' : 'h-10 rounded-xl [@media(max-height:860px)]:h-9'} ${selected
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
    >
      <div className={`grid h-full place-content-center ${compact ? 'w-10' : 'w-12'}`}>
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>

      {open && (
        <span className={`font-medium whitespace-nowrap ${compact ? 'text-[13px]' : 'text-sm'}`}>
          {title}
        </span>
      )}

      {notifs && open && (
        <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground font-bold">
          {notifs}
        </span>
      )}
    </Link>
  );
};

const TitleSection = ({ open, user }: { open: boolean, user?: any }) => {
  return (
    <div className="mb-2 [@media(max-height:760px)]:mb-1">
      <div className="flex items-center gap-3 p-1.5">
        <div className="grid size-10 shrink-0 place-content-center rounded-xl border border-white/10 bg-black shadow-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
          <LogoIcon className="h-6 w-auto relative z-10" />
        </div>
        {open && (
          <div className="flex-1 overflow-hidden">
            <span className="block text-sm font-bold tracking-tight uppercase truncate">
              NOCHBOT
            </span>
            <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
              {user?.plan || 'Free'} Plan
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ToggleClose = ({ open, setOpen }: any) => {
  return (
    <button
      onClick={() => setOpen(!open)}
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      className="mt-2 border-t border-border hover:bg-accent transition-colors rounded-lg overflow-hidden cursor-pointer w-full"
    >
      <div className="flex items-center p-1.5">
        <div className="grid size-9 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 transition-transform duration-300 text-muted-foreground ${open ? "rotate-180" : ""
              }`}
          />
        </div>
        {open && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Collapse
          </span>
        )}
      </div>
    </button>
  );
};

// Below md the sidebar is hidden, so the same grouped destinations open from a left drawer.
const MobileNav = ({ user }: { user?: any }) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const handleLogout = useLogout();

  // Close after navigation, including back/forward.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="md:hidden grid size-11 place-content-center rounded-xl text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[min(20rem,85vw)] flex-col gap-0 bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
        <TitleSection open user={user} />
        <nav aria-label="Dashboard" className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <NavGroups pathname={pathname} open />
        </nav>
        <div className="border-t border-border pt-2 space-y-1">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarOption
              key={item.href}
              Icon={item.icon}
              title={item.title}
              href={item.href}
              selected={pathname === item.href}
              open
              compact
            />
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-full items-center rounded-lg transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <div className="grid h-full w-10 place-content-center">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="text-[13px] font-medium">Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const DashboardHeader = ({ isDark, setIsDark, user }: any) => {
  const handleLogout = useLogout();

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-2 px-3 md:px-6 sticky top-0 z-40">
      <div className="flex min-w-0 items-center gap-1">
        <MobileNav user={user} />
        <Link href="/dashboard" aria-label="NochBot dashboard" className="md:hidden flex items-center">
          <Wordmark height={20} />
        </Link>
        <h2 className="hidden md:block text-sm font-semibold text-muted-foreground uppercase tracking-[0.2em]">
          Command Center
        </h2>
      </div>
      <div className="flex items-center gap-1.5 md:gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-11 md:size-10 place-content-center rounded-xl bg-accent/50 text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full"></span>
        </button>
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="grid size-11 md:size-10 place-content-center rounded-xl bg-accent/50 text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Account menu" className="flex min-h-11 items-center gap-3 pl-1 md:pl-2 group cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-foreground leading-none group-hover:text-primary transition-colors">{user?.name || user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Account Menu</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20 text-primary font-bold group-hover:scale-105 transition-transform">
                <Avatar className="h-full w-full rounded-xl">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-transparent text-primary font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-card border-border shadow-2xl" align="end">
            <PopoverHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20 text-primary font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <PopoverTitle className="truncate">{user?.name || 'User'}</PopoverTitle>
                  <PopoverDescription className="text-[10px] truncate">{user?.email}</PopoverDescription>
                </div>
              </div>
            </PopoverHeader>
            <PopoverBody className="space-y-1 px-2 py-2">
              <Button variant="ghost" className="w-full justify-start text-xs h-9 cursor-pointer" asChild>
                <Link href="/dashboard/account">
                  <User className="mr-2 h-4 w-4" />
                  View Profile
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start text-xs h-9 cursor-pointer" asChild>
                <Link href="/dashboard/configure">
                  <Settings className="mr-2 h-4 w-4" />
                  Bot Settings
                </Link>
              </Button>
            </PopoverBody>
            <PopoverFooter className="py-2 border-t border-border">
              <Button
                variant="ghost"
                className="w-full justify-start text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </PopoverFooter>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};
