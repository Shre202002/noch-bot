/**
 * What an event still needs before it can go live. One definition used by the event page and by the publish API,
 * so what the organizer sees and what the server enforces cannot drift apart.
 */

export type ReadinessTab = 'details' | 'fields' | 'ticket' | 'gateway' | 'live';

export type ReadinessStep = {
  id: 'details' | 'fields' | 'design' | 'payments';
  label: string;
  /** Why it is not done yet, or a one-line description when it is. */
  hint: string;
  done: boolean;
  /** The tab where the organizer completes this step. */
  tab: ReadinessTab;
};

type EventLike = {
  name?: string | null;
  description?: string | null;
  capacity?: number | null;
  is_paid?: boolean | null;
  ticket_template_id?: string | null;
  ticket_color_palette?: object | null;
  ticket_design_confirmed_at?: Date | string | null;
};

/** The template every new event starts with. Having it says nothing about the organizer's choice. */
export const DEFAULT_TEMPLATE_ID = 'default';

/**
 * Whether the organizer has actually saved a ticket design. New events start with the default template, so the
 * template alone proves nothing: saving the design stamps `ticket_design_confirmed_at`. Events saved before that
 * stamp existed count as confirmed when they carry a custom template or a color palette.
 */
export function isTicketDesignConfirmed(event: EventLike): boolean {
  if (event.ticket_design_confirmed_at) return true;
  const palette = event.ticket_color_palette;
  if (palette && Object.keys(palette).length > 0) return true;
  return !!event.ticket_template_id && event.ticket_template_id !== DEFAULT_TEMPLATE_ID;
}

export function eventReadiness(
  event: EventLike,
  context: { fieldCount: number; gatewayActive: boolean }
): { steps: ReadinessStep[]; complete: boolean; missing: ReadinessStep[] } {
  const detailsDone = !!event.name?.trim() && !!event.description?.trim() && (event.capacity ?? 0) > 0;

  const steps: ReadinessStep[] = [
    {
      id: 'details',
      label: 'Event details',
      hint: detailsDone ? 'Name, description and capacity are set.' : 'Add a name, a description and a capacity above zero.',
      done: detailsDone,
      tab: 'details',
    },
    {
      id: 'fields',
      label: 'Attendee form',
      hint: context.fieldCount > 0 ? `${context.fieldCount} question${context.fieldCount === 1 ? '' : 's'} added.` : 'Add at least one question for attendees to answer.',
      done: context.fieldCount > 0,
      tab: 'fields',
    },
    {
      id: 'design',
      label: 'Ticket design',
      hint: isTicketDesignConfirmed(event) ? 'Ticket design saved.' : 'Choose a ticket design and save it.',
      done: isTicketDesignConfirmed(event),
      tab: 'ticket',
    },
  ];

  // Free events never charge anyone, so they have no payment step at all.
  if (event.is_paid) {
    steps.push({
      id: 'payments',
      label: 'Payments',
      hint: context.gatewayActive ? 'Payment gateway connected.' : 'Connect a payment gateway so attendees can pay.',
      done: context.gatewayActive,
      tab: 'gateway',
    });
  }

  const missing = steps.filter((s) => !s.done);
  return { steps, complete: missing.length === 0, missing };
}

/** "Ticket design and Payments" for the publish error message. */
export function describeMissing(missing: Array<{ label: string }>): string {
  const names = missing.map((m) => m.label);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
