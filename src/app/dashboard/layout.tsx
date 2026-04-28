import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="p-4 flex items-center gap-4 border-b">
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
