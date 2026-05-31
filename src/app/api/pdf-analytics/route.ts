import { NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();

    // ── Overview stats ────────────────────────────────────────
    const [totalSessions, totalMessages, pdfs] = await Promise.all([
      db.collection('chat_sessions').countDocuments({ userId }),
      db.collection('chat_messages').countDocuments({ ownerId: userId }),
      db.collection('pdf_files').find({ userId }).toArray(),
    ]);

    // Unique visitors by IP
    const uniqueIPs = await db.collection('chat_sessions').distinct('ip', { userId, ip: { $ne: '' } });

    // Avg messages per session
    const avgResult = await db.collection('chat_sessions').aggregate([
      { $match: { userId } },
      { $group: { _id: null, avg: { $avg: '$messageCount' } } },
    ]).toArray();
    const avgMessages = avgResult[0]?.avg?.toFixed(1) || '0';

    // ── Sessions over time (last 30 days) ─────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessionsOverTime = await db.collection('chat_sessions').aggregate([
      { $match: { userId, createdAt: { $gte: thirtyDaysAgo.toISOString() } } },
      {
        $group: {
          _id: { $substr: ['$createdAt', 0, 10] }, // group by date YYYY-MM-DD
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const messagesOverTime = await db.collection('chat_messages').aggregate([
      { $match: { ownerId: userId, createdAt: { $gte: thirtyDaysAgo.toISOString() }, role: 'user' } },
      {
        $group: {
          _id: { $substr: ['$createdAt', 0, 10] },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    // ── Per PDF stats ─────────────────────────────────────────
    const pdfStats = await db.collection('chat_sessions').aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$fileId',
          sessions: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' },
          lastActive: { $max: '$lastActiveAt' },
          label: { $first: '$label' },
        },
      },
      { $sort: { sessions: -1 } },
    ]).toArray();

    // ── Recent sessions ───────────────────────────────────────
    const recentSessions = await db.collection('chat_sessions')
      .find({ userId })
      .sort({ lastActiveAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      stats: {
        totalSessions,
        totalMessages,
        uniqueVisitors: uniqueIPs.length,
        avgMessages,
      },
      sessionsOverTime: sessionsOverTime.map(s => ({ date: s._id, count: s.count })),
      messagesOverTime: messagesOverTime.map(m => ({ date: m._id, count: m.count })),
      pdfStats: pdfStats.map(p => ({
        fileId: p._id,
        label: p.label,
        sessions: p.sessions,
        totalMessages: p.totalMessages,
        lastActive: p.lastActive,
      })),
      recentSessions: recentSessions.map(s => ({
        sessionId: s.sessionId,
        slug: s.slug,
        fileId: s.fileId,
        label: s.label,
        messageCount: s.messageCount,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        ip: s.ip,
        userAgent: s.userAgent,
      })),
    });
  } catch (err: any) {
    console.error('[pdf-analytics]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}