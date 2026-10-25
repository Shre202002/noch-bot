"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search, Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type UserRow = {
  id: string;
  email: string;
  name?: string;
  plan: string;
  planExpiresAt?: string;
  role?: string;
  disabled?: boolean;
  emailVerified?: boolean;
  createdAt: string;
};

type Detail = {
  user: UserRow & { disabledReason: string | null; hasGoogle: boolean; planSource: string | null };
  usage: { messagesThisMonth: number; crawlsThisMonth: number };
  counts: Record<string, number>;
  knowledge: { lastCrawl?: string; chunkCount?: number } | null;
  history: Array<{ month: string; messages: number }>;
  bookingStatuses: Record<string, number>;
};

const PAGE_SIZE = 25;

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminUsersPage() {
  const PLAN_KEYS = usePlanKeys();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      if (role) params.set("role", role);
      const data = await api(`/api/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, q, plan, status, role]);

  // Deep link from other admin pages (for example Health): /admin/users?open=<id> opens that user.
  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get("open");
    if (open) setSelected(open);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} total</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email or id"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <select
          className="rounded-md border border-[var(--nb-line)] bg-[var(--nb-surface)] px-3 text-sm"
          value={plan}
          onChange={(e) => {
            setPage(1);
            setPlan(e.target.value);
          }}
        >
          <option value="">All plans</option>
          {PLAN_KEYS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-[var(--nb-line)] bg-[var(--nb-surface)] px-3 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Deactivated</option>
          <option value="unverified">Email unverified</option>
        </select>
        <select
          className="rounded-md border border-[var(--nb-line)] bg-[var(--nb-surface)] px-3 text-sm"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
        >
          <option value="">Any role</option>
          <option value="superadmin">Super admins</option>
        </select>
      </div>

      <BulkBar
        ids={[...checked]}
        planKeys={PLAN_KEYS}
        onClear={() => setChecked(new Set())}
        onDone={() => {
          setChecked(new Set());
          load();
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-[var(--nb-line)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--nb-surface)] text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={users.length > 0 && users.every((u) => checked.has(u.id))}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      users.forEach((u) => (e.target.checked ? next.add(u.id) : next.delete(u.id)));
                      return next;
                    })
                  }
                />
              </th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u.id)}
                  className="cursor-pointer border-t border-[var(--nb-line)] hover:bg-[var(--nb-surface)]"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.email}`}
                      checked={checked.has(u.id)}
                      onChange={(e) =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(u.id);
                          else next.delete(u.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name || u.email}</span>
                      {u.role === "superadmin" && <ShieldCheck className="h-3.5 w-3.5 text-signal" />}
                    </div>
                    {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {u.plan}
                    {u.planExpiresAt && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        until {new Date(u.planExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.disabled ? (
                        <Badge variant="destructive">Deactivated</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                      {u.emailVerified === false && <Badge variant="outline">Unverified</Badge>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <UserDialog id={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function usePlanKeys(): string[] {
  const [keys, setKeys] = useState<string[]>(["free", "starter", "pro"]);
  useEffect(() => {
    api("/api/admin/plans")
      .then((d) => setKeys(d.plans.map((p: { key: string }) => p.key)))
      .catch(() => {});
  }, []);
  return keys;
}

function UserDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const PLAN_KEYS = usePlanKeys();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [planKey, setPlanKey] = useState("free");
  const [expiry, setExpiry] = useState("");
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const d: Detail = await api(`/api/admin/users/${id}`);
      setDetail(d);
      setPlanKey(d.user.plan);
      setExpiry(d.user.planExpiresAt ? d.user.planExpiresAt.slice(0, 10) : "");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setDetail(null);
    setMsg("");
    setReason("");
    refresh();
  }, [refresh]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      await refresh();
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const u = detail?.user;

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{u ? u.name || u.email : "User"}</DialogTitle>
          <DialogDescription>{u?.email}</DialogDescription>
        </DialogHeader>

        {!detail && !msg && <p className="py-6 text-sm text-muted-foreground">Loading…</p>}

        {detail && u && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Messages this month" value={detail.usage.messagesThisMonth} />
              <Stat label="Crawls this month" value={detail.usage.crawlsThisMonth} />
              <Stat label="Events" value={detail.counts.events} />
              <Stat label="Bookings" value={detail.counts.bookings} />
              <Stat label="Documents" value={detail.counts.pdfs} />
              <Stat label="Conversations" value={detail.counts.conversations} />
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Messages, last 6 months</h3>
                <Link
                  href={`/admin/users/${u.id}/chats`}
                  className="text-xs font-medium text-signal underline-offset-2 hover:underline"
                >
                  View chat history
                </Link>
              </div>
              <MessageHistory history={detail.history} />
              {Object.keys(detail.bookingStatuses).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Bookings:{" "}
                  {Object.entries(detail.bookingStatuses)
                    .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
                    .join(" · ")}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Plan</h3>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  className="rounded-md border border-[var(--nb-line)] bg-[var(--nb-surface)] px-3 py-2"
                  value={planKey}
                  onChange={(e) => setPlanKey(e.target.value)}
                >
                  {PLAN_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Expires (optional)</label>
                  <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api(`/api/admin/users/${u.id}/plan`, "POST", { plan: planKey, expiresAt: expiry || null }),
                      "Plan updated",
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Access</h3>
              {u.disabled ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Deactivated{u.disabledReason ? `: ${u.disabledReason}` : ""}. Sign-in and widget are blocked.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(() => api(`/api/admin/users/${u.id}/status`, "POST", { disabled: false }), "Reactivated")
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-[200px] flex-1"
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api(`/api/admin/users/${u.id}/status`, "POST", { disabled: true, reason }),
                        "Deactivated",
                      )
                    }
                  >
                    <Ban className="mr-2 h-4 w-4" /> Deactivate
                  </Button>
                </div>
              )}
            </section>

            {u.emailVerified === false && (
              <section className="space-y-2">
                <h3 className="font-medium">Email</h3>
                <p className="text-xs text-muted-foreground">
                  Not verified. This user cannot crawl, upload documents or set up a chatbot until they enter the code
                  from their Account page.
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => api(`/api/admin/users/${u.id}/verify`, "POST"), "Marked as verified")}
                >
                  Mark email as verified
                </Button>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="font-medium">Data</h3>
              <p className="text-xs text-muted-foreground">
                Queues spreadsheet rows without an embedding; the owner's dashboard embeds them next time they open the
                document.
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    const r = await api(`/api/admin/users/${u.id}/reindex`, "POST");
                    setMsg(`Queued ${r.rows} rows across ${r.documents} documents`);
                  } catch (e) {
                    setMsg((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Re-queue embeddings
              </Button>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Role</h3>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api(`/api/admin/users/${u.id}`, "PATCH", {
                        role: u.role === "superadmin" ? null : "superadmin",
                      }),
                    u.role === "superadmin" ? "Admin role removed" : "Promoted to super admin",
                  )
                }
              >
                {u.role === "superadmin" ? "Remove super admin" : "Make super admin"}
              </Button>
            </section>
          </div>
        )}

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--nb-line)] bg-[var(--nb-surface)] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function MessageHistory({ history }: { history: Array<{ month: string; messages: number }> }) {
  const max = Math.max(1, ...history.map((h) => h.messages));
  return (
    <div className="flex h-24 items-end gap-2">
      {history.map((h) => (
        <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">{h.messages}</span>
          <div
            className="w-full rounded-sm bg-signal/70"
            style={{ height: `${Math.max(2, (h.messages / max) * 56)}px` }}
            title={`${h.month}: ${h.messages} messages`}
          />
          <span className="text-[10px] text-muted-foreground">{h.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function BulkBar({
  ids,
  planKeys,
  onClear,
  onDone,
}: {
  ids: string[];
  planKeys: string[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [planKey, setPlanKey] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (ids.length === 0) return null;

  async function run(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api("/api/admin/users/bulk", "POST", { ids, ...body });
      const failures = (r.results as Array<{ ok: boolean; error?: string }>).filter((x) => !x.ok);
      if (failures.length) {
        setMsg(`${r.succeeded} done, ${r.failed} refused: ${[...new Set(failures.map((f) => f.error))].join("; ")}`);
      } else {
        onDone();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{ids.length} selected</span>
        <select
          className="rounded-md border border-[var(--nb-line)] bg-background px-2 py-1.5"
          value={planKey}
          onChange={(e) => setPlanKey(e.target.value)}
          aria-label="Plan to apply"
        >
          <option value="">Choose plan…</option>
          {planKeys.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Input className="w-full sm:w-40" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Plan expiry" />
        <Button size="sm" disabled={busy || !planKey} onClick={() => run({ action: "plan", plan: planKey, expiresAt: expiry || null })}>
          Apply plan
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => run({ action: "deactivate" }, `Deactivate ${ids.length} accounts? Their sessions stop immediately.`)}
        >
          Deactivate
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: "reactivate" })}>
          Reactivate
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
