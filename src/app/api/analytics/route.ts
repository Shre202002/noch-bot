import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getAnalytics } from "@/lib/conversations";
import { readKnowledge, findAccountById } from "@/lib/storage";
import { checkMessageLimit, checkCrawlLimit } from "@/lib/ratelimit";
import { resolvePlanKey } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [analytics, knowledge, account] = await Promise.all([
      getAnalytics(userId),
      readKnowledge(userId),
      findAccountById(userId),
    ]);

    const analyticsData = analytics as typeof analytics & {
      totalEvents?: number;
      topEvents?: unknown[];
      funnel?: Record<string, number>;
    };
    const plan = await resolvePlanKey(account);

    const [messageQuota, crawlQuota] = await Promise.all([
      checkMessageLimit(userId, plan),
      checkCrawlLimit(userId, plan),
    ]);

    return NextResponse.json({
      ...analytics,
      totalEvents: analyticsData.totalEvents ?? 0,
      topEvents: analyticsData.topEvents ?? [],
      funnel: analyticsData.funnel ?? {},
      topQuestions: analytics.topQuestions ?? [],
      deviceBreakdown: analytics.deviceBreakdown ?? {},
      messagesLast7Days: analytics.messagesLast7Days ?? [],
      botName: knowledge?.botName || "AI Assistant",
      websiteUrl: knowledge?.url || "",
      chunksIndexed: knowledge?.chunkCount || 0,
      lastCrawl: knowledge?.crawledAt || null,
      quota: {
        messages: {
          used: messageQuota.used,
          limit: messageQuota.limit,
          remaining: Math.max(0, messageQuota.limit - messageQuota.used),
          resetDate: messageQuota.resetDate,
          percentUsed: Math.round((messageQuota.used / messageQuota.limit) * 100),
        },
        crawls: {
          used: crawlQuota.used,
          limit: crawlQuota.limit,
          remaining: Math.max(0, crawlQuota.limit - crawlQuota.used),
          percentUsed: Math.round((crawlQuota.used / crawlQuota.limit) * 100),
        },
      },
      plan,
    });
  } catch (err: any) {
    console.error("[analytics] error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
