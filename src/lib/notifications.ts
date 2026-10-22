import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';

export type NotificationItem = {
  id: string;
  type: 'booking' | 'refund' | 'chat';
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const WINDOW_DAYS = 30;
const MAX_ITEMS = 20;

/**
 * Builds the organizer's activity feed from existing data (no separate notifications collection):
 * confirmed bookings, payments waiting on a refund decision, and new website chats.
 * Everything is scoped to the owning userId; `unread` counts items newer than the account's last "mark as read".
 */
export async function getNotifications(userId: string): Promise<{ items: NotificationItem[]; unread: number }> {
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [bookings, chats, account] = await Promise.all([
    db
      .collection('bookings')
      .find({
        org_id: userId,
        is_test: { $ne: true },
        status: { $in: ['confirmed', 'needs_refund'] },
        updated_at: { $gte: since },
      })
      .sort({ updated_at: -1 })
      .limit(MAX_ITEMS)
      .toArray(),
    db
      .collection('conversations')
      .find({ userId, startedAt: { $gte: since } })
      .sort({ startedAt: -1 })
      .limit(MAX_ITEMS)
      .toArray(),
    findAccountById(userId),
  ]);

  const items: NotificationItem[] = [
    ...bookings.map((b): NotificationItem => {
      const refund = b.status === 'needs_refund';
      const who = b.attendee?.name || b.attendee?.email || 'A visitor';
      const event = b.event_snapshot?.name || 'your event';
      return {
        id: `booking:${b._id}`,
        type: refund ? 'refund' : 'booking',
        title: refund ? 'Refund needed' : 'New booking confirmed',
        body: refund
          ? `${who} paid after seats ran out for ${event}.`
          : `${who} booked ${event}.`,
        href: '/dashboard/bookings',
        createdAt: new Date(b.updated_at ?? b.created_at).toISOString(),
      };
    }),
    ...chats.map((c): NotificationItem => ({
      id: `chat:${c._id}`,
      type: 'chat',
      title: 'New chat',
      body: c.website ? `A visitor started a chat on ${c.website}.` : 'A visitor started a chat.',
      href: '/dashboard/history',
      createdAt: new Date(c.startedAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ITEMS);

  const seenAt = account?.notificationsSeenAt ?? '';
  const unread = items.filter((i) => i.createdAt > seenAt).length;
  return { items, unread };
}
