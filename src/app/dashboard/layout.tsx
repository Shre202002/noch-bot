import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
    LayoutGrid,
    Settings,
    Code,
    BarChart2,
    User,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const navItems = [
    { href: "/dashboard", icon: LayoutGrid, label: "Overview", tooltip: "Overview" },
    { href: "/dashboard/configure", icon: Settings, label: "Configure", tooltip: "Configure" },
    { href: "/dashboard/embed", icon: Code, label: "Embed", tooltip: "Embed" },
    { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics", tooltip: "Analytics" },
    { href: "/dashboard/account", icon: User, label: "Account", tooltip: "Account" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar-1');

  return (
    <SidebarProvider>
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <Logo />
                    <span className="font-semibold text-xl group-data-[collapsible=icon]:hidden">Nocta</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {navItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <Link href={item.href} legacyBehavior passHref>
                                <SidebarMenuButton tooltip={item.tooltip}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                        {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User Avatar" />}
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-sm group-data-[collapsible=icon]:hidden">
                        <span className="font-medium text-foreground">User</span>
                        <span className="text-muted-foreground">user@example.com</span>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
        <SidebarInset>
            <header className="p-4 flex items-center gap-4">
                <SidebarTrigger />
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            </header>
            <main className="p-4">
               {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
