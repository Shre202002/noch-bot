import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getAnalytics } from "@/lib/conversations";
import { readKnowledge } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [analytics, knowledge] = await Promise.all([
      getAnalytics(userId),
      readKnowledge(userId),
    ]);

    return NextResponse.json({
      ...analytics,
      botName: knowledge?.botName || "AI Assistant",
      websiteUrl: knowledge?.url || "",
      chunksIndexed: knowledge?.chunkCount || 0,
      lastCrawl: knowledge?.crawledAt || null,
    });
  } catch (err: any) {
    console.error("[analytics] error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}