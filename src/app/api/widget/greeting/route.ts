import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fallbackGreeting, getWidgetGreeting } from "@/lib/widgetGreeting";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/widget/greeting?userId=… → { greeting, siteName }
// The embedded widget's first message, tailored to the crawled site (generated once per crawl, then cached).
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: corsHeaders });

  try {
    const result = await getWidgetGreeting(await getDb(), userId);
    return NextResponse.json(result, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("[widget_greeting]", err);
    return NextResponse.json(
      { greeting: fallbackGreeting("this website"), siteName: "this website" },
      { headers: corsHeaders }
    );
  }
}
