/** Pure maths for the free tools, kept apart from the UI so it can be tested. Every input is the visitor's own number. */

const num = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export type SupportCostInput = {
  chatsPerMonth: number;
  minutesPerChat: number;
  hourlyCost: number;
  /** Share of chats the chatbot answers on its own, 0 to 100. This is the visitor's assumption, not a promise. */
  deflectionPercent: number;
};

export function supportCostSavings(i: SupportCostInput) {
  const deflection = Math.min(100, num(i.deflectionPercent)) / 100;
  const monthlyCost = (num(i.chatsPerMonth) * num(i.minutesPerChat) * num(i.hourlyCost)) / 60;
  const monthlySaving = monthlyCost * deflection;
  return {
    hoursSavedPerMonth: (num(i.chatsPerMonth) * num(i.minutesPerChat) * deflection) / 60,
    monthlyCost,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
  };
}

export type TicketRevenueInput = {
  price: number;
  seats: number;
  /** Share of seats you expect to sell, 0 to 100. */
  soldPercent: number;
  /** Payment gateway percentage fee, for example 2. */
  gatewayFeePercent: number;
  /** Fixed fee per transaction, in the same currency as the price. */
  fixedFee: number;
  /** Average tickets per booking; the fixed fee applies once per booking. */
  ticketsPerBooking: number;
};

export function ticketRevenue(i: TicketRevenueInput) {
  const sold = Math.round(num(i.seats) * (Math.min(100, num(i.soldPercent)) / 100));
  const gross = sold * num(i.price);
  const bookings = sold === 0 ? 0 : Math.ceil(sold / Math.max(1, num(i.ticketsPerBooking)));
  const fees = gross * (num(i.gatewayFeePercent) / 100) + bookings * num(i.fixedFee);
  return { ticketsSold: sold, gross, fees, net: Math.max(0, gross - fees), bookings };
}

/**
 * Smallest plan whose monthly message allowance covers the estimate. `plans` come from /api/plans, so limits and
 * prices are whatever the admin has set; this never hard-codes them.
 */
export function recommendPlan<T extends { limits: { messagesPerMonth: number }; sortOrder: number }>(
  plans: T[],
  messagesPerMonth: number,
): T | null {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((p) => p.limits.messagesPerMonth >= num(messagesPerMonth)) ?? null;
}

export const money = (v: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
