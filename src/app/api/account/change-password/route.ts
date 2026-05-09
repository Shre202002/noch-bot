import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserIdFromCookie } from "@/lib/auth";
import { findAccountById, updatePassword } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "All fields required" }, { status: 400 });

  if (newPassword.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const account = await findAccountById(userId);
  if (!account)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!valid)
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await updatePassword(account.email, hash);

  return NextResponse.json({ success: true });
}