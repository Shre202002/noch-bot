import { NoctaDashboard } from "@/components/ui/dashboard-with-collapsible-sidebar";
import { getUserIdFromCookie } from "@/lib/auth";
import { findAccountById } from "@/lib/storage";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getUserIdFromCookie();
  
  if (!userId) {
    redirect("/");
  }

  const user = await findAccountById(userId);
  
  if (!user) {
    redirect("/");
  }

  // We omit password hashes for security
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    avatar: user.avatar
  };

  return (
    <NoctaDashboard user={safeUser}>
      {children}
    </NoctaDashboard>
  );
}
