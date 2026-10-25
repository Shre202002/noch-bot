import { AdminShell } from "@/components/ui/admin-shell";
import { getSessionAccount } from "@/lib/auth";
import { ensureBootstrapAdmin } from "@/lib/superAdmin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const found = await getSessionAccount();
  if (!found) redirect("/login");

  const account = await ensureBootstrapAdmin(found);
  if (account.role !== "superadmin") redirect("/dashboard");

  return (
    <AdminShell admin={{ id: account.id, email: account.email, name: account.name }}>
      {children}
    </AdminShell>
  );
}
