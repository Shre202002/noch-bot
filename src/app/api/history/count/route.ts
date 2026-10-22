import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const total = await db.collection("conversations").countDocuments({ userId });
    return NextResponse.json({ total });
  } catch (err) {
    console.error("[history_count] error:", err);
    return NextResponse.json({ error: "Failed to fetch count" }, { status: 500 });
  }
}
