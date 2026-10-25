"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Limits = {
  messagesPerMonth: number;
  crawlsPerMonth: number;
  crawlPagesPerCrawl: number;
  pdfDocuments: number | null;
  additionalFiles: number;
};

type PlanRow = {
  key: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  active: boolean;
  highlight: boolean;
  sortOrder: number;
  features: string[];
  limits: Limits;
  userCount?: number;
};

const BLANK: PlanRow = {
  key: "",
  name: "",
  priceMonthly: 0,
  priceYearly: 0,
  currency: "INR",
  active: true,
  highlight: false,
  sortOrder: 10,
  features: [],
  limits: { messagesPerMonth: 1000, crawlsPerMonth: 5, crawlPagesPerCrawl: 20, pdfDocuments: 5, additionalFiles: 2 },
};

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

function money(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const count = (n: number | null) => (n === null ? "Unlimited" : n.toLocaleString());

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/admin/plans");
      setPlans([...data.plans].sort((a: PlanRow, b: PlanRow) => a.sortOrder - b.sortOrder));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(p: PlanRow, active: boolean) {
    setPlans((prev) => prev.map((x) => (x.key === p.key ? { ...x, active } : x)));
    try {
      await api(`/api/admin/plans/${p.key}`, "PATCH", { ...p, active });
    } catch (e) {
      setError((e as Error).message);
    }
    load();
  }

  const totalUsers = useMemo(() => plans.reduce((n, p) => n + (p.userCount ?? 0), 0), [plans]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Plans</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Limits and prices apply immediately to enforcement, the pricing section and customers' account pages.
            {totalUsers > 0 && ` ${totalUsers.toLocaleString()} users across ${plans.length} plans.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setIsNew(true);
            setEditing(BLANK);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New plan
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <article
            key={p.key}
            className={cn(
              "flex flex-col rounded-xl border bg-[var(--nb-surface)] p-5",
              p.highlight ? "border-signal" : "border-[var(--nb-line)]",
              !p.active && "opacity-70",
            )}
          >
            <header className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{p.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">{p.key}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {p.highlight && <Badge>Highlighted</Badge>}
                {!p.active && <Badge variant="outline">Hidden</Badge>}
              </div>
            </header>

            <div className="mt-4">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {money(p.priceMonthly, p.currency)}
                {p.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
              </p>
              {p.priceYearly > 0 && (
                <p className="text-xs text-muted-foreground">{money(p.priceYearly, p.currency)} billed yearly</p>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--nb-line)] pt-4 text-sm">
              <Limit label="Messages / month" value={count(p.limits.messagesPerMonth)} />
              <Limit label="Crawls / month" value={count(p.limits.crawlsPerMonth)} />
              <Limit label="Pages / crawl" value={count(p.limits.crawlPagesPerCrawl)} />
              <Limit label="Documents" value={count(p.limits.pdfDocuments)} />
              <Limit label="Extra files / doc" value={count(p.limits.additionalFiles)} />
            </dl>

            <footer className="mt-5 flex items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {(p.userCount ?? 0).toLocaleString()} user{p.userCount === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Active
                  <Switch
                    checked={p.active}
                    onCheckedChange={(v) => toggleActive(p, v)}
                    disabled={p.key === "free"}
                    aria-label={`${p.name} active`}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsNew(false);
                    setEditing(p);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </footer>
          </article>
        ))}

        <button
          onClick={() => {
            setIsNew(true);
            setEditing(BLANK);
          }}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--nb-line)] text-sm text-muted-foreground hover:border-signal hover:text-foreground"
        >
          <Plus className="h-5 w-5" /> Create a plan
        </button>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "New plan" : `Edit ${editing?.name || editing?.key}`}</DialogTitle>
            <DialogDescription>Changes are saved to the live plan when you press Save.</DialogDescription>
          </DialogHeader>
          {editing && (
            <PlanForm
              plan={editing}
              isNew={isNew}
              onSaved={() => {
                setEditing(null);
                load();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PlanForm({
  plan,
  isNew,
  onSaved,
  onCancel,
}: {
  plan: PlanRow;
  isNew: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlanRow>(plan);
  const [features, setFeatures] = useState(plan.features.join("\n"));
  const [unlimitedDocs, setUnlimitedDocs] = useState(plan.limits.pdfDocuments === null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const setLimit = (k: keyof Limits, v: string) =>
    setForm((f) => ({ ...f, limits: { ...f.limits, [k]: v === "" ? 0 : Math.max(0, Number(v)) } }));
  const numberInput = (value: number, onChange: (v: string) => void, disabled = false) => (
    <Input type="number" min={0} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  );

  const featureList = features.split("\n").map((l) => l.trim()).filter(Boolean);

  async function save() {
    setBusy(true);
    setMsg("");
    const body = {
      ...form,
      features: featureList,
      limits: { ...form.limits, pdfDocuments: unlimitedDocs ? null : form.limits.pdfDocuments ?? 0 },
    };
    try {
      if (isNew) await api("/api/admin/plans", "POST", body);
      else await api(`/api/admin/plans/${plan.key}`, "PATCH", body);
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the ${plan.name} plan?`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/plans/${plan.key}`, "DELETE");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <Section title="Basics">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Key (permanent)">
              {isNew ? (
                <Input
                  placeholder="e.g. business"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                />
              ) : (
                <Input value={plan.key} disabled />
              )}
            </Field>
            <Field label="Display name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active (shown to customers)
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={form.highlight} onCheckedChange={(v) => setForm({ ...form, highlight: v })} /> Highlight as recommended
            </label>
          </div>
        </Section>

        <Section title="Pricing" hint="Whole units of the currency (rupees, not paise).">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Monthly">{numberInput(form.priceMonthly, (v) => setForm({ ...form, priceMonthly: Number(v) }))}</Field>
            <Field label="Yearly">{numberInput(form.priceYearly, (v) => setForm({ ...form, priceYearly: Number(v) }))}</Field>
            <Field label="Currency">
              <Input
                maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Sort order">{numberInput(form.sortOrder, (v) => setForm({ ...form, sortOrder: Number(v) }))}</Field>
          </div>
        </Section>

        <Section title="Limits" hint="Enforced immediately for everyone on this plan.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Messages / month">
              {numberInput(form.limits.messagesPerMonth, (v) => setLimit("messagesPerMonth", v))}
            </Field>
            <Field label="Crawls / month">
              {numberInput(form.limits.crawlsPerMonth, (v) => setLimit("crawlsPerMonth", v))}
            </Field>
            <Field label="Pages / crawl (max 50)">
              {numberInput(form.limits.crawlPagesPerCrawl, (v) => setLimit("crawlPagesPerCrawl", v))}
            </Field>
            <Field label="Documents">
              {numberInput(form.limits.pdfDocuments ?? 0, (v) => setLimit("pdfDocuments", v), unlimitedDocs)}
              <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={unlimitedDocs} onCheckedChange={setUnlimitedDocs} /> Unlimited
              </label>
            </Field>
            <Field label="Extra files / document">
              {numberInput(form.limits.additionalFiles, (v) => setLimit("additionalFiles", v))}
            </Field>
          </div>
        </Section>

        <Section title="Features shown to customers" hint="One per line.">
          <textarea
            className="min-h-[110px] w-full rounded-md border border-[var(--nb-line)] bg-background px-3 py-2 text-sm"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
          />
        </Section>
      </div>

      <aside className="space-y-2">
        <h3 className="text-sm font-medium">Customer preview</h3>
        <div
          className={cn(
            "rounded-xl border bg-background p-5",
            form.highlight ? "border-signal" : "border-[var(--nb-line)]",
            !form.active && "opacity-60",
          )}
        >
          <p className="text-base font-semibold">{form.name || "Plan name"}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {money(form.priceMonthly, form.currency || "INR")}
            {form.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {featureList.map((f, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" /> <span>{f}</span>
              </li>
            ))}
            {featureList.length === 0 && <li className="text-muted-foreground">No features listed.</li>}
          </ul>
          {!form.active && <p className="mt-3 text-xs text-muted-foreground">Hidden from the pricing page.</p>}
        </div>
      </aside>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--nb-line)] pt-4 md:col-span-2">
        <Button onClick={save} disabled={busy || !form.name.trim() || (isNew && !form.key.trim())}>
          {isNew ? "Create plan" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {!isNew && plan.key !== "free" && (
          <Button variant="outline" className="ml-auto" onClick={remove} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        )}
        {msg && <span className="text-sm text-destructive">{msg}</span>}
      </div>
    </div>
  );
}
