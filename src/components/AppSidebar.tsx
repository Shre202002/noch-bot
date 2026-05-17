"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Code2, BarChart3, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoIcon } from "./logo";

const items = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Bot Config", url: "/dashboard/configure", icon: Settings },
  { title: "Embed Codes", url: "/dashboard/embed", icon: Code2 },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Account", url: "/dashboard/account", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 bg-transparen">
          <LogoIcon className="h-6 w-6 bg-transparen" />
          {!collapsed && <span className="text-lg font-bold text-sidebar-foreground uppercase tracking-tight">NOCHQ</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}