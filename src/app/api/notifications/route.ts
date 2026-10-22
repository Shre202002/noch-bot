import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await getNotifications(userId));
  } catch (err) {
    console.error("[notifications_get] error:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
