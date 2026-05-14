// import { NextResponse } from "next/server";
// import { getUserIdFromCookie } from "@/lib/auth";
// import { getAnalytics } from "@/lib/conversations";
// import { readKnowledge } from "@/lib/storage";

// export const dynamic = "force-dynamic";

// export async function GET() {
//   try {
//     const userId = await getUserIdFromCookie();
//     if (!userId)
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const [analytics, knowledge] = await Promise.all([
//       getAnalytics(userId),
//       readKnowledge(userId),
//     ]);

//     return NextResponse.json({
//       ...analytics,
//       botName: knowledge?.botName || "AI Assistant",
//       websiteUrl: knowledge?.url || "",
//       chunksIndexed: knowledge?.chunkCount || 0,
//       lastCrawl: knowledge?.crawledAt || null,
//     });
//   } catch (err: any) {
//     console.error("[analytics] error:", err);
//     return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
//   }
// }










import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getAnalytics } from "@/lib/conversations";
import { readKnowledge, findAccountById } from "@/lib/storage";
import { checkMessageLimit, checkCrawlLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [analytics, knowledge, account] = await Promise.all([
      getAnalytics(userId),
      readKnowledge(userId),
      findAccountById(userId),
    ]);

    const plan = account?.plan || "free";

    // Get real-time quota usage
    const [messageQuota, crawlQuota] = await Promise.all([
      checkMessageLimit(userId, plan),
      checkCrawlLimit(userId, plan),
    ]);

    return NextResponse.json({
      ...analytics,
      botName: knowledge?.botName || "AI Assistant",
      websiteUrl: knowledge?.url || "",
      chunksIndexed: knowledge?.chunkCount || 0,
      lastCrawl: knowledge?.crawledAt || null,
      // Quota data
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