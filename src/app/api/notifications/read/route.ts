import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { updateAccount } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await updateAccount(userId, { notificationsSeenAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications_read] error:", err);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
