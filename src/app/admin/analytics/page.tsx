"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; value: number };
type Analytics = {
  days: number;
  signups: Point[];
  messages: Point[];
  usersByPlan: Array<{ plan: string; count: number }>;
  mrr: Array<{ plan: string; name: string; subscribers: number; currency: string; monthly: number }>;
  ticketSales: Array<{ currency: string; gross: number; bookings: number }>;
};

const RANGES = [7, 30, 90];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Request failed");
        if (!cancelled) setData(body);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Usage and revenue</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-md border px-3 py-1 text-xs ${
                days === r
                  ? "border-signal bg-[var(--nb-surface)] text-foreground"
                  : "border-[var(--nb-line)] text-muted-foreground hover:text-foreground"
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="New sign-ups per day" total={sum(data.signups)}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.signups}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nb-line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} minTickGap={24} />
                  <YAxis allowDecimals={false} fontSize={11} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" name="Sign-ups" fill="var(--signal, #3b82f6)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Chat messages per day" total={sum(data.messages)}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.messages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nb-line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} minTickGap={24} />
                  <YAxis allowDecimals={false} fontSize={11} width={40} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" name="Messages" stroke="var(--signal, #3b82f6)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Estimated subscription revenue</h2>
            <p className="text-xs text-muted-foreground">
              Active subscribers times list price. Accounts placed on a plan by an admin are excluded.
            </p>
            <div className="overflow-x-auto rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--nb-line)] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Users</th>
                    <th className="px-4 py-2 font-medium">Paying</th>
                    <th className="px-4 py-2 font-medium">Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mrr.map((m) => (
                    <tr key={m.plan} className="border-b border-[var(--nb-line)] last:border-0">
                      <td className="px-4 py-2">{m.name}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {data.usersByPlan.find((u) => u.plan === m.plan)?.count ?? 0}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{m.subscribers}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {m.monthly.toLocaleString()} {m.currency}
                      </td>
                    </tr>
                  ))}
                  {data.mrr.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No paid plans defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Ticket sales in the last {data.days} days</h2>
            <p className="text-xs text-muted-foreground">
              Gross paid bookings across all organizers, by currency. This is organizer revenue, not platform income.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {data.ticketSales.map((t) => (
                <li key={t.currency} className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
                  <p className="text-xs uppercase text-muted-foreground">{t.currency}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{t.gross.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t.bookings.toLocaleString()} bookings</p>
                </li>
              ))}
              {data.ticketSales.length === 0 && <li className="text-sm text-muted-foreground">No paid bookings in this period.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function sum(points: Point[]): number {
  return points.reduce((n, p) => n + p.value, 0);
}

function ChartCard({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{total.toLocaleString()} total</span>
      </div>
      {children}
    </section>
  );
}
