import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getConversationHistory } from "@/lib/conversations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || undefined;

    const data = await getConversationHistory(userId, page, limit, search);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[history] error:", err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}