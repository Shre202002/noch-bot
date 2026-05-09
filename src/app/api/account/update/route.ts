import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { updateAccount } from "@/lib/storage";
 
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
 
  await updateAccount(userId, { name: name.trim() });
  return NextResponse.json({ success: true });
}