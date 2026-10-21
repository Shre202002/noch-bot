import { NextRequest, NextResponse } from "next/server"
import { getUserIdFromCookie } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

const STEP_FIELDS = {
  preview: "previewTestedAt",
  embed: "embedCopiedAt",
} as const

// POST /api/knowledge/progress  Body: { step: "preview" | "embed" }
// Records a completed Configure step so its tick survives a reload. The first completion time is kept.
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const field = STEP_FIELDS[body?.step as keyof typeof STEP_FIELDS]
  if (!field) return NextResponse.json({ error: "Unknown step" }, { status: 400 })

  const db = await getDb()
  await db.collection("knowledge").updateOne(
    { userId },
    [{ $set: { userId, [`setupProgress.${field}`]: { $ifNull: [`$setupProgress.${field}`, new Date().toISOString()] } } }],
    { upsert: true }
  )
  return NextResponse.json({ success: true })
}
