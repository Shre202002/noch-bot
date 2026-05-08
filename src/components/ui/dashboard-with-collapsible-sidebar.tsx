
"use client"
import React, { useState, useEffect } from "react";
import {
  Home,
  MessageSquare,
  Globe,
  Bot,
  BarChart3,
  Users,
  ChevronDown,
  ChevronsRight,
  Moon,
  Sun,
  TrendingUp,
  Activity,
  Package,
  Bell,
  Settings,
  HelpCircle,
  User,
  LogOut,
  Code2
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoIcon } from "@/components/logo";
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
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { icon: Home, title: "Overview", href: "/dashboard" },
    { icon: Bot, title: "Bot Config", href: "/dashboard/configure" },
    { icon: Code2, title: "Embed Codes", href: "/dashboard/embed" },
    { icon: BarChart3, title: "Analytics", href: "/dashboard/analytics" },
    { icon: MessageSquare, title: "History", href: "/dashboard/history", notifs: 4 },
  ];

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r border-border transition-all duration-300 ease-in-out hidden md:flex flex-col ${
        open ? 'w-64' : 'w-20'
      } bg-card p-4 shadow-sm z-50`}
    >
      <TitleSection open={open} user={user} />

      <div className="space-y-2 flex-1 mt-4">
        {navItems.map((item) => (
          <SidebarOption
            key={item.title}
            Icon={item.icon}
            title={item.title}
            href={item.href}
            selected={pathname === item.href}
            open={open}
            notifs={item.notifs}
          />
        ))}
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <SidebarOption
          Icon={User}
          title="Account"
          href="/dashboard/account"
          selected={pathname === "/dashboard/account"}
          open={open}
        />
        <button
           onClick={handleLogout}
           className={`flex h-11 w-full items-center rounded-xl transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group cursor-pointer`}
        >
          <div className="grid h-full w-12 place-content-center">
            <LogOut className="h-5 w-5" />
          </div>
          {open && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

const SidebarOption = ({ Icon, title, href, selected, open, notifs }: any) => {
  return (
    <Link
      href={href}
      className={`relative flex h-11 w-full items-center rounded-xl transition-all duration-200 ${
        selected 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-5 w-5" />
      </div>
      
      {open && (
        <span className="text-sm font-medium whitespace-nowrap">
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
    <div className="mb-4">
      <div className="flex items-center gap-3 p-2">
        <div className="grid size-10 shrink-0 place-content-center rounded-xl bg-white shadow-sm overflow-hidden">
           <LogoIcon className="h-6 w-auto" />
        </div>
        {open && (
          <div className="flex-1 overflow-hidden">
             <span className="block text-sm font-bold tracking-tight uppercase truncate">
               NOCTA
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
      className="mt-4 border-t border-border hover:bg-accent transition-colors rounded-xl overflow-hidden cursor-pointer w-full"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 transition-transform duration-300 text-muted-foreground ${
              open ? "rotate-180" : ""
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

const DashboardHeader = ({ isDark, setIsDark, user }: any) => {
  const router = useRouter();
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.2em]">
          Command Center
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-xl bg-accent/50 text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full"></span>
        </button>
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-xl bg-accent/50 text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-3 pl-2 group cursor-pointer outline-none">
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
