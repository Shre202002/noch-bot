import { NextResponse } from "next/server"
import { getUserIdFromCookie } from "@/lib/auth"
import { readKnowledge } from "@/lib/storage"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const knowledge = await readKnowledge(userId)

  if (!knowledge) {
    return NextResponse.json({
      url: null,
      crawledAt: null,
      systemPrompt: null,
      theme: null,
      hasCrawled: false,
    })
  }

  // Return everything EXCEPT content (too large)
  return NextResponse.json({
    url: knowledge.url || null,
    crawledAt: knowledge.crawledAt || null,
    systemPrompt: knowledge.systemPrompt || null,
    theme: knowledge.theme || null,
    hasCrawled: !!knowledge.url,
  })
}
