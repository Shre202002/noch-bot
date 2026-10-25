import { getDb } from '@/lib/db';
import { getPlans } from '@/lib/plans';

const DAY = 24 * 60 * 60 * 1000;

export type DayPoint = { date: string; value: number };

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fills missing days with zero so charts get a continuous series. `days` ends today (UTC), oldest first. */
export function fillDailySeries(counts: Map<string, number>, days: number, now: Date = new Date()): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(new Date(now.getTime() - i * DAY));
    out.push({ date, value: counts.get(date) ?? 0 });
  }
  return out;
}

export type MrrLine = { plan: string; name: string; subscribers: number; currency: string; monthly: number };

/**
 * Estimated monthly recurring revenue: paying accounts on each plan times its list price. Accounts an admin
 * placed on a plan (planSource "admin") are comps, so they are excluded.
 */
export function estimateMrr(
  plans: Array<{ key: string; name: string; priceMonthly: number; currency: string }>,
  paying: Map<string, number>,
): MrrLine[] {
  return plans
    .filter((p) => p.priceMonthly > 0)
    .map((p) => {
      const subscribers = paying.get(p.key) ?? 0;
      return { plan: p.key, name: p.name, subscribers, currency: p.currency, monthly: subscribers * p.priceMonthly };
    });
}

async function dailyCounts(collection: string, field: string, match: Record<string, unknown>, since: Date, isDate: boolean) {
  const db = await getDb();
  const rows = await db
    .collection(collection)
    .aggregate([
      { $match: { ...match, [field]: { $gte: isDate ? since : since.toISOString() } } },
      {
        $group: {
          _id: isDate
            ? { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }
            : { $substrBytes: [`$${field}`, 0, 10] },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), r.count as number]));
}

export async function loadAnalytics(days = 30, now: Date = new Date()) {
  const db = await getDb();
  const since = new Date(now.getTime() - (days - 1) * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const plans = await getPlans({ includeInactive: true });

  const [signups, messages, perPlan, paying, ticketSales] = await Promise.all([
    dailyCounts('accounts', 'createdAt', {}, since, false),
    dailyCounts('messages', 'createdAt', { role: 'user' }, since, true),
    db.collection('accounts').aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]).toArray(),
    db
      .collection('accounts')
      .aggregate([
        { $match: { planSource: { $ne: 'admin' }, 'subscription.status': 'active', disabled: { $ne: true } } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection('bookings')
      .aggregate([
        { $match: { status: 'confirmed', payment_status: 'paid', updated_at: { $gte: since } } },
        {
          $group: {
            _id: { $ifNull: ['$currency', 'unknown'] },
            gross: { $sum: { $ifNull: ['$amount_total', { $ifNull: ['$amount_charged', 0] }] } },
            bookings: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  return {
    days,
    signups: fillDailySeries(signups, days, now),
    messages: fillDailySeries(messages, days, now),
    usersByPlan: perPlan.map((p) => ({ plan: String(p._id ?? 'free'), count: p.count as number })),
    mrr: estimateMrr(plans, new Map(paying.map((p) => [String(p._id), p.count as number]))),
    ticketSales: ticketSales.map((t) => ({ currency: String(t._id), gross: t.gross as number, bookings: t.bookings as number })),
  };
}
