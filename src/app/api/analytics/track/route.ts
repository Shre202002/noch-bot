import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/storage";
import { getUserIdFromCookie } from "@/lib/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const [analytics, knowledge, account] = await Promise.all([...])


export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, page, sourceUrl, metadata, visitorId, sessionId } = body;

    if (!event) {
      return NextResponse.json({ error: "Missing event name" }, { status: 400, headers: corsHeaders });
    }

    // Try to get userId from cookie if authenticated
    const userId = await getUserIdFromCookie();

    await trackAnalyticsEvent({
      userId: userId || null,
      visitorId: visitorId || null,
      sessionId: sessionId || null,
      event,
      page: page || null,
      sourceUrl: sourceUrl || null,
      metadata: metadata || {},
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[analytics/track] error:", err.message);
    // Still return 200 to prevent client-side errors from retrying/breaking
    return NextResponse.json({ success: false }, { status: 200, headers: corsHeaders });
  }
}
