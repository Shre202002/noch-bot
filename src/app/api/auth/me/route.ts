import { NextResponse } from "next/server"
import { getUserIdFromCookie } from "@/lib/auth"
import { findAccountById } from "@/lib/storage"
import { resolvePlanKey } from "@/lib/plans"
import { ensureBootstrapAdmin } from "@/lib/superAdmin"

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const found = await findAccountById(userId)
  if (!found)
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  const account = await ensureBootstrapAdmin(found)

  return NextResponse.json({
    id: account.id,
    email: account.email,
    name: account.name ?? null,
    plan: await resolvePlanKey(account),
    planExpiresAt: account.planExpiresAt ?? null,
    crawlCount: account.crawlCount,
    isSuperAdmin: account.role === "superadmin",
    emailVerified: account.emailVerified !== false,
  })
}
