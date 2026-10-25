"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Layers, ScrollText, Activity, BarChart3, ShieldCheck, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/health", label: "Health", icon: Activity },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminShell({
  admin,
  children,
}: {
  admin: { id: string; email: string; name?: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--nb-line)] bg-[var(--nb-surface)] md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <ShieldCheck className="h-5 w-5 text-signal" />
          <span className="text-sm font-semibold tracking-tight">NochBot Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-signal/10 text-signal"
                    : "text-muted-foreground hover:bg-[var(--nb-surface-2)] hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--nb-line)] p-4 text-xs text-muted-foreground">
          <p className="truncate">{admin.name || admin.email}</p>
          <Link href="/dashboard" className="mt-2 inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--nb-line)] bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <ShieldCheck className="h-5 w-5 shrink-0 text-signal" />
          <nav className="-mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-4 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map(({ href, label, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5",
                    active ? "bg-signal/10 text-signal" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <Link href="/dashboard" className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground">
              Dashboard
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8 md:py-6">{children}</main>
      </div>
    </div>
  );
}
