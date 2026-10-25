import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';

export type ChatSource = 'website' | 'pdf';

export type ChatSummary = {
  id: string;
  title: string;
  visitor?: string;
  messageCount: number;
  startedAt?: string;
  lastActiveAt?: string;
  preview: string;
};

export type ChatThread = {
  chat: { id: string; title: string; visitor?: string; startedAt?: string; lastActiveAt?: string };
  messages: Array<{ role: string; content: string; createdAt?: string }>;
  truncated: boolean;
};

export const THREAD_MESSAGE_CAP = 500;

const iso = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function parseSource(value: string | null): ChatSource {
  return value === 'pdf' ? 'pdf' : 'website';
}

/**
 * Conversations visitors had with the owner's assistants. `userId` is always the owner (the account being
 * inspected), so one account's chats are never reachable through another account's id.
 * Visitor IP and user agent are intentionally left out.
 */
export async function listChats(
  userId: string,
  source: ChatSource,
  page = 1,
  pageSize = 20,
): Promise<{ chats: ChatSummary[]; total: number }> {
  const db = await getDb();
  const skip = (Math.max(1, page) - 1) * pageSize;

  if (source === 'website') {
    const conversations = db.collection('conversations');
    const [rows, total] = await Promise.all([
      conversations.find({ userId }).sort({ lastMessageAt: -1 }).skip(skip).limit(pageSize).toArray(),
      conversations.countDocuments({ userId }),
    ]);
    const ids = rows.map((r) => String(r._id));
    const firsts = await db
      .collection('messages')
      .find({ userId, conversationId: { $in: ids }, role: 'user' }, { projection: { conversationId: 1, content: 1 } })
      .sort({ createdAt: 1 })
      .toArray();
    const preview = new Map<string, string>();
    for (const m of firsts) if (!preview.has(m.conversationId)) preview.set(m.conversationId, String(m.content ?? ''));

    return {
      total,
      chats: rows.map((r) => ({
        id: String(r._id),
        title: r.website || 'unknown site',
        visitor: r.visitorId && r.visitorId !== 'anonymous' ? String(r.visitorId) : undefined,
        messageCount: r.messageCount ?? 0,
        startedAt: iso(r.startedAt),
        lastActiveAt: iso(r.lastMessageAt),
        preview: (preview.get(String(r._id)) ?? 'No messages').slice(0, 120),
      })),
    };
  }

  const sessions = db.collection('chat_sessions');
  const [rows, total] = await Promise.all([
    sessions.find({ userId }).sort({ lastActiveAt: -1 }).skip(skip).limit(pageSize).toArray(),
    sessions.countDocuments({ userId }),
  ]);
  const sessionIds = rows.map((r) => r.sessionId);
  const firsts = await db
    .collection('chat_messages')
    .find({ ownerId: userId, sessionId: { $in: sessionIds }, role: 'user' }, { projection: { sessionId: 1, content: 1 } })
    .sort({ createdAt: 1 })
    .toArray();
  const preview = new Map<string, string>();
  for (const m of firsts) if (!preview.has(m.sessionId)) preview.set(m.sessionId, String(m.content ?? ''));

  return {
    total,
    chats: rows.map((r) => ({
      id: String(r.sessionId),
      title: r.label || r.slug || 'Shared document',
      visitor: r.loginId || undefined,
      messageCount: r.messageCount ?? 0,
      startedAt: iso(r.createdAt),
      lastActiveAt: iso(r.lastActiveAt),
      preview: (preview.get(String(r.sessionId)) ?? 'No messages').slice(0, 120),
    })),
  };
}

/** One full conversation, or null when it does not belong to `userId`. */
export async function getThread(userId: string, source: ChatSource, id: string): Promise<ChatThread | null> {
  const db = await getDb();

  if (source === 'website') {
    if (!ObjectId.isValid(id)) return null;
    const conv = await db.collection('conversations').findOne({ _id: new ObjectId(id), userId });
    if (!conv) return null;
    const rows = await db
      .collection('messages')
      .find({ conversationId: id, userId }, { projection: { role: 1, content: 1, createdAt: 1 } })
      .sort({ createdAt: 1 })
      .limit(THREAD_MESSAGE_CAP + 1)
      .toArray();
    return {
      chat: {
        id,
        title: conv.website || 'unknown site',
        visitor: conv.visitorId && conv.visitorId !== 'anonymous' ? String(conv.visitorId) : undefined,
        startedAt: iso(conv.startedAt),
        lastActiveAt: iso(conv.lastMessageAt),
      },
      messages: rows.slice(0, THREAD_MESSAGE_CAP).map((m) => ({ role: m.role, content: String(m.content ?? ''), createdAt: iso(m.createdAt) })),
      truncated: rows.length > THREAD_MESSAGE_CAP,
    };
  }

  const session = await db.collection('chat_sessions').findOne({ sessionId: id, userId });
  if (!session) return null;
  const rows = await db
    .collection('chat_messages')
    .find({ sessionId: id, ownerId: userId }, { projection: { role: 1, content: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .limit(THREAD_MESSAGE_CAP + 1)
    .toArray();
  return {
    chat: {
      id,
      title: session.label || session.slug || 'Shared document',
      visitor: session.loginId || undefined,
      startedAt: iso(session.createdAt),
      lastActiveAt: iso(session.lastActiveAt),
    },
    messages: rows.slice(0, THREAD_MESSAGE_CAP).map((m) => ({ role: m.role, content: String(m.content ?? ''), createdAt: iso(m.createdAt) })),
    truncated: rows.length > THREAD_MESSAGE_CAP,
  };
}
