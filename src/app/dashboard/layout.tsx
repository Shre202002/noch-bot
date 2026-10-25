import { NoctaDashboard } from "@/components/ui/dashboard-with-collapsible-sidebar";
import { getUserIdFromCookie } from "@/lib/auth";
import { findAccountById } from "@/lib/storage";
import { resolvePlanKey } from "@/lib/plans";
import { redirect } from "next/navigation";
import Link from "next/link";
import { needsEmailVerification } from "@/lib/emailVerification";

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
    plan: await resolvePlanKey(user),
    avatar: user.avatar
  };

  return (
    <NoctaDashboard user={safeUser}>
      {needsEmailVerification(user) && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          Verify your email to crawl websites, upload documents and set up your chatbot.{" "}
          <Link href="/dashboard/account" className="font-medium underline underline-offset-2">
            Verify now
          </Link>
        </div>
      )}
      {children}
    </NoctaDashboard>
  );
}
