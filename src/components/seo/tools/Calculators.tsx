'use client';

import { useEffect, useState } from 'react';
import { money, recommendPlan, supportCostSavings, ticketRevenue } from '@/lib/seo/calculators';

const INPUT =
  'h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white focus:border-[#36f4a4]/60 focus:outline-none';

function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={`${INPUT} mt-1.5`}
      />
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function Result({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 ${strong ? 'text-2xl text-[#36f4a4]' : 'text-xl'} font-semibold`}>{value}</p>
    </div>
  );
}

export function RoiCalculator() {
  const [chats, setChats] = useState(500);
  const [minutes, setMinutes] = useState(6);
  const [hourly, setHourly] = useState(250);
  const [deflect, setDeflect] = useState(30);
  const r = supportCostSavings({ chatsPerMonth: chats, minutesPerChat: minutes, hourlyCost: hourly, deflectionPercent: deflect });

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <Field id="chats" label="Chats or enquiries per month" value={chats} onChange={setChats} />
        <Field id="minutes" label="Minutes to handle each one" value={minutes} onChange={setMinutes} />
        <Field id="hourly" label="Cost of one support hour (₹)" value={hourly} onChange={setHourly} />
        <Field
          id="deflect"
          label="Share a chatbot answers on its own (%)"
          value={deflect}
          onChange={setDeflect}
          hint="Your assumption, not a promise. Start low and test with real questions."
        />
      </div>
      <div className="grid gap-3 content-start" aria-live="polite">
        <Result label="Support cost today, per month" value={money(r.monthlyCost)} />
        <Result label="Hours freed per month" value={r.hoursSavedPerMonth.toFixed(1)} />
        <Result label="Possible saving per month" value={money(r.monthlySaving)} strong />
        <Result label="Possible saving per year" value={money(r.yearlySaving)} />
      </div>
    </div>
  );
}

export function TicketRevenueCalculator() {
  const [price, setPrice] = useState(499);
  const [seats, setSeats] = useState(200);
  const [sold, setSold] = useState(80);
  const [pct, setPct] = useState(2);
  const [fixed, setFixed] = useState(0);
  const [group, setGroup] = useState(2);
  const r = ticketRevenue({ price, seats, soldPercent: sold, gatewayFeePercent: pct, fixedFee: fixed, ticketsPerBooking: group });

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <Field id="price" label="Ticket price (₹)" value={price} onChange={setPrice} />
        <Field id="seats" label="Seats available" value={seats} onChange={setSeats} />
        <Field id="sold" label="Seats you expect to sell (%)" value={sold} onChange={setSold} />
        <Field id="pct" label="Gateway fee (%)" value={pct} onChange={setPct} hint="Check your payment provider's current fee page." />
        <Field id="fixed" label="Fixed fee per booking (₹)" value={fixed} onChange={setFixed} />
        <Field id="group" label="Average tickets per booking" value={group} onChange={setGroup} />
      </div>
      <div className="grid gap-3 content-start" aria-live="polite">
        <Result label="Tickets sold" value={String(r.ticketsSold)} />
        <Result label="Gross revenue" value={money(r.gross)} />
        <Result label="Estimated gateway fees" value={money(r.fees)} />
        <Result label="Net to your account" value={money(r.net)} strong />
      </div>
    </div>
  );
}

type LivePlan = {
  key: string;
  name: string;
  priceMonthly: number;
  currency: string;
  sortOrder: number;
  limits: { messagesPerMonth: number };
};

export function PlanEstimator() {
  const [visitors, setVisitors] = useState(2000);
  const [openRate, setOpenRate] = useState(5);
  const [perChat, setPerChat] = useState(6);
  const [plans, setPlans] = useState<LivePlan[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('plans'))))
      .then((d) => alive && setPlans(d.plans))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const messages = Math.round(visitors * (openRate / 100) * perChat);
  const plan = plans ? recommendPlan(plans, messages) : null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <Field id="visitors" label="Website visitors per month" value={visitors} onChange={setVisitors} />
        <Field id="open" label="Visitors who open the chat (%)" value={openRate} onChange={setOpenRate} hint="Your assumption. Many sites see a small share, so start low." />
        <Field id="per" label="Messages in a typical chat" value={perChat} onChange={setPerChat} />
      </div>
      <div className="grid gap-3 content-start" aria-live="polite">
        <Result label="Estimated messages per month" value={messages.toLocaleString('en-IN')} />
        {failed && <p role="alert" className="text-sm text-red-400">Could not load the current plans. Please try again later.</p>}
        {!plans && !failed && <p className="text-sm text-white/50">Loading current plans…</p>}
        {plans && plan && (
          <Result
            label="Smallest plan that covers it"
            strong
            value={`${plan.name}${plan.priceMonthly ? ` · ${money(plan.priceMonthly, plan.currency)}/month` : ' · Free'}`}
          />
        )}
        {plans && !plan && (
          <p className="text-sm text-white/60">That is above the largest plan&apos;s monthly messages. Contact us for a custom setup.</p>
        )}
      </div>
    </div>
  );
}
