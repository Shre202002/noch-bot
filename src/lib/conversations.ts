import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import type { Conversation, Message } from '@/models/Conversation';


// ── Ensure indexes exist (call once at startup or in each route) ──
export async function ensureIndexes() {
    const db = await getDb();
    const conv = db.collection('conversations');
    const msgs = db.collection('messages');

    await conv.createIndex({ userId: 1 });
    await conv.createIndex({ sessionId: 1 });
    await conv.createIndex({ userId: 1, lastMessageAt: -1 });

    await msgs.createIndex({ conversationId: 1 });
    await msgs.createIndex({ userId: 1, createdAt: -1 });
    await msgs.createIndex({ sessionId: 1 });
}

// ── Create or find conversation for this session ──────────────────
export async function createOrFindConversation(
    userId: string,
    sessionId: string,
    visitorId: string,
    website: string
): Promise<string> {
    const db = await getDb();
    const coll = db.collection<Conversation>('conversations');

    const existing = await coll.findOne({ userId, sessionId });
    if (existing) return existing._id!.toString();

    const now = new Date();
    const result = await coll.insertOne({
        userId,
        sessionId,
        visitorId,
        website,
        messageCount: 0,
        startedAt: now,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
    });

    return result.insertedId.toString();
}

// ── Save a message ────────────────────────────────────────────────
export async function saveMessage(data: Omit<Message, '_id' | 'createdAt'>) {
    const db = await getDb();
    await db.collection<Message>('messages').insertOne({
        ...data,
        createdAt: new Date(),
    });
}

// ── Update conversation stats after message ───────────────────────
export async function updateConversationStats(conversationId: string) {
    const db = await getDb();
    await db.collection('conversations').updateOne(
        { _id: new ObjectId(conversationId) },
        {
            $inc: { messageCount: 1 },
            $set: { lastMessageAt: new Date(), updatedAt: new Date() },
        }
    );
}

// ── Get paginated conversation list for history page ──────────────
export async function getConversationHistory(
    userId: string,
    page = 1,
    limit = 20,
    search?: string
) {
    const db = await getDb();
    const coll = db.collection('conversations');

    const filter: any = { userId };
    if (search) {
        // Search by website
        filter.website = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const total = await coll.countDocuments(filter);

    const conversations = await coll
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

    // Attach first message preview for each conversation
    const msgColl = db.collection('messages');
    const enriched = await Promise.all(
        conversations.map(async (conv) => {
            const firstMsg = await msgColl.findOne(
                { conversationId: conv._id!.toString(), role: 'user' },
                { sort: { createdAt: 1 } }
            );
            return {
                ...conv,
                _id: String(conv._id),
                userId: conv.userId,
                sessionId: conv.sessionId,
                website: conv.website,
                messageCount: conv.messageCount,
                lastMessageAt: conv.lastMessageAt,
                startedAt: conv.startedAt,
                preview: firstMsg?.content?.slice(0, 100) || 'No messages',
            };
        })
    );

    return {
        conversations: enriched,
        total,
        page,
        pages: Math.ceil(total / limit),
    };
}

// ── Get full message thread for a conversation ────────────────────
export async function getMessageThread(
    conversationId: string,
    userId: string
) {
    const db = await getDb();

    const conversation = await db
        .collection("conversations")
        .findOne({
            _id: new ObjectId(conversationId),
            userId,
        });

    if (!conversation) {
        return null;
    }

    const messages = await db
        .collection("messages")
        .find({
            conversationId,
            userId,
        })
        .sort({ createdAt: 1 })
        .toArray();

    return {
        conversation,
        messages,
    };
}

// ── Analytics aggregations ────────────────────────────────────────
export async function getAnalytics(userId: string) {
    const db = await getDb();
    const convColl = db.collection('conversations');
    const msgColl = db.collection('messages');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [
        totalConversations,
        totalMessages,
        recentConversations,
        messagesLast7Days,
        topQuestions,
        avgResponseTime,
        conversationsByWebsite,
        activeToday,
        deviceBreakdown,
    ] = await Promise.all([
        // Total conversations
        convColl.countDocuments({ userId }),

        // Total messages
        msgColl.countDocuments({ userId }),

        // Recent conversations (last 7 days)
        convColl.countDocuments({ userId, startedAt: { $gte: sevenDaysAgo } }),

        // Messages per day (last 7 days)
        msgColl
            .aggregate([
                { $match: { userId, createdAt: { $gte: sevenDaysAgo }, role: 'user' } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ])
            .toArray(),

        // Top 10 questions
        msgColl
            .aggregate([
                { $match: { userId, role: 'user' } },
                {
                    $group: {
                        _id: '$content',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ])
            .toArray(),

        // Avg response time
        msgColl
            .aggregate([
                { $match: { userId, role: 'assistant', responseTimeMs: { $exists: true } } },
                {
                    $group: {
                        _id: null,
                        avg: { $avg: '$responseTimeMs' },
                    },
                },
            ])
            .toArray(),

        // Conversations by website
        convColl
            .aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$website',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ])
            .toArray(),

        // Active visitors today
        convColl.countDocuments({ userId, lastMessageAt: { $gte: todayStart } }),

        // Device Breakdown
        msgColl
            .aggregate([
                { $match: { userId, role: 'user', 'metadata.device': { $exists: true } } },
                { $group: { _id: '$metadata.device', count: { $sum: 1 } } }
            ])
            .toArray(),
    ]);

    // Fill missing days with 0
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const found = (messagesLast7Days as any[]).find((x) => x._id === key);
        last7Days.push({ date: key, count: found?.count || 0 });
    }

    return {
        totalConversations,
        totalMessages,
        recentConversations,
        activeToday,
        avgResponseTimeMs: Math.round((avgResponseTime as any[])[0]?.avg || 0),
        messagesLast7Days: last7Days,
        topQuestions: (topQuestions as any[]).map((q) => ({
            question: q._id,
            count: q.count,
        })),
        conversationsByWebsite: (conversationsByWebsite as any[]).map((w) => ({
            website: w._id || 'unknown',
            count: w.count,
        })),
        deviceBreakdown: (deviceBreakdown as any[]).reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {}),
        avgMessagesPerConversation:
            totalConversations > 0
                ? Math.round((totalMessages / totalConversations) * 10) / 10
                : 0,
    };
}
