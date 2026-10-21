import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { OwnerAction } from "@/lib/linkAuthCore";
import { getScannerLinkForEvent, ownerScannerAction } from "@/lib/scannerLinkAuth";

const ACTIONS: OwnerAction[] = ["approve", "reject", "block", "unblock", "signout", "remove"];

// PATCH /api/events/[id]/scanner-users/[userId]  Body: { action }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const ownerId = await getUserIdFromCookie();
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, userId } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body.action as OwnerAction;
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const db = await getDb();
    // The link is looked up by this owner and event, so an organizer can only manage accounts on their own event's link.
    const link = await getScannerLinkForEvent(db, ownerId, new ObjectId(id));
    if (!link) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const done = await ownerScannerAction(db, ownerId, link.slug, userId, action);
    if (!done) {
      return NextResponse.json({ error: "That change is not possible for this account anymore." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[scanner_users_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
