"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Service = {
  name: string;
  state: "ok" | "degraded" | "down" | "not_configured";
  detail?: string;
  latencyMs?: number;
};

type Owner = { id: string; name: string | null; email: string | null; disabled: boolean };

type Health = {
  checkedAt: string;
  services: Service[];
  queues: {
    failedDocuments: {
      count: number;
      recent: Array<{ fileId: string; userId: string; owner: Owner; name?: string; docType?: string; error?: string; uploadedAt?: string }>;
    };
    pendingRowEmbeddings: number;
    needsRefund: {
      count: number;
      recent: Array<{ id: string; orgId?: string; owner?: Owner; eventId?: string; amount?: number | null; currency?: string; updatedAt?: string }>;
    };
    lateOrStuckPayments: number;
  };
};

const STATE_LABEL: Record<Service["state"], string> = {
  ok: "Healthy",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

function stateVariant(state: Service["state"]): "secondary" | "destructive" | "outline" {
  if (state === "ok") return "secondary";
  if (state === "not_configured") return "outline";
  return "destructive";
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/health");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setHealth(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = health?.queues;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Platform health</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {health && <span>Checked {new Date(health.checkedAt).toLocaleTimeString()}</span>}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Services</h2>
        <ul className="divide-y divide-[var(--nb-line)] rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)]">
          {health?.services.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>{s.name}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {s.detail && <span>{s.detail}</span>}
                {s.latencyMs !== undefined && <span className="tabular-nums">{s.latencyMs} ms</span>}
                <Badge variant={stateVariant(s.state)}>{STATE_LABEL[s.state]}</Badge>
              </span>
            </li>
          ))}
          {!health && <li className="px-4 py-6 text-sm text-muted-foreground">{loading ? "Checking…" : "No data"}</li>}
        </ul>
      </section>

      {q && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Failed documents" value={q.failedDocuments.count} warn={q.failedDocuments.count > 0} />
            <Tile label="Rows awaiting embedding" value={q.pendingRowEmbeddings} />
            <Tile label="Payments needing refund" value={q.needsRefund.count} warn={q.needsRefund.count > 0} />
            <Tile label="Late payments stuck > 1h" value={q.lateOrStuckPayments} warn={q.lateOrStuckPayments > 0} />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Failed or interrupted documents</h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--nb-line)] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Document</th>
                    <th className="px-4 py-2 font-medium">Owner</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium">Uploaded</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.failedDocuments.recent.map((f) => (
                    <tr key={f.fileId} className="border-b border-[var(--nb-line)] last:border-0">
                      <td className="px-4 py-2">
                        <div>{f.name || f.fileId}</div>
                        {f.docType && <div className="text-xs uppercase text-muted-foreground">{f.docType}</div>}
                      </td>
                      <td className="px-4 py-2">
                        <OwnerCell owner={f.owner} />
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{f.error || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums">
                        {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <OpenUser id={f.userId} />
                      </td>
                    </tr>
                  ))}
                  {q.failedDocuments.recent.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No failed documents.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Refund queue</h2>
            <p className="text-xs text-muted-foreground">
              Paid after the seats were released. The organizer refunds in the payment provider and marks it refunded.
            </p>
            <div className="overflow-x-auto rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--nb-line)] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Booking</th>
                    <th className="px-4 py-2 font-medium">Organizer</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {q.needsRefund.recent.map((b) => (
                    <tr key={b.id} className="border-b border-[var(--nb-line)] last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{b.id}</td>
                      <td className="px-4 py-2">{b.owner ? <OwnerCell owner={b.owner} /> : "-"}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {b.amount != null ? `${b.amount} ${b.currency ?? ""}` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums">
                        {b.updatedAt ? new Date(b.updatedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">{b.orgId && <OpenUser id={b.orgId} />}</td>
                    </tr>
                  ))}
                  {q.needsRefund.recent.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Nothing waiting for a refund.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function OwnerCell({ owner }: { owner: Owner }) {
  if (!owner.email && !owner.name) {
    return <span className="font-mono text-xs text-muted-foreground">{owner.id} (account not found)</span>;
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <span>{owner.name || owner.email}</span>
        {owner.disabled && <Badge variant="destructive">Deactivated</Badge>}
      </div>
      {owner.name && owner.email && <div className="text-xs text-muted-foreground">{owner.email}</div>}
    </div>
  );
}

function OpenUser({ id }: { id: string }) {
  return (
    <Link href={`/admin/users?open=${encodeURIComponent(id)}`} className="text-xs font-medium text-signal hover:underline">
      Open user
    </Link>
  );
}

function Tile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-destructive" : ""}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
