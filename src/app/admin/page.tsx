import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminOverviewPage() {
  const db = await getDb();
  const accounts = db.collection("accounts");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const in7 = new Date(now.getTime() + 7 * DAY).toISOString();

  const [total, disabled, admins, plans, messages, signups30, expiring, recentUsers, recentAudit] =
    await Promise.all([
      accounts.countDocuments({}),
      accounts.countDocuments({ disabled: true }),
      accounts.countDocuments({ role: "superadmin" }),
      accounts.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]).toArray(),
      db.collection("messages").countDocuments({ role: "user", createdAt: { $gte: monthStart } }),
      accounts.countDocuments({ createdAt: { $gte: since30 } }),
      accounts.countDocuments({ planExpiresAt: { $gt: now.toISOString(), $lte: in7 } }),
      accounts
        .find({}, { projection: { _id: 0, id: 1, email: 1, name: 1, plan: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
      db
        .collection("admin_audit_log")
        .find({}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
    ]);

  const cards = [
    { label: "Total users", value: total },
    { label: "New in 30 days", value: signups30 },
    { label: "Deactivated", value: disabled },
    { label: "Super admins", value: admins },
    { label: "Messages this month", value: messages },
    { label: "Plans expiring in 7 days", value: expiring },
    ...plans.map((p) => ({ label: `${String(p._id ?? "free")} plan`, value: p.count as number })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
            <p className="text-xs capitalize text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent sign-ups</h2>
            <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground">
              All users
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{u.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {u.plan} · {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
            {recentUsers.length === 0 && <li className="text-muted-foreground">No users yet.</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent admin activity</h2>
            <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-foreground">
              Audit log
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {recentAudit.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs">{a.action}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.adminEmail || a.adminId} · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
            {recentAudit.length === 0 && <li className="text-muted-foreground">No admin actions yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
