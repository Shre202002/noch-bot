import { NextResponse } from "next/server"
import { getUserIdFromCookie } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { readKnowledge } from "@/lib/storage"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const knowledge = await readKnowledge(userId)

  // Setup steps the Configure page shows as done: a saved theme, a preview chat, and an installed widget (embed code
  // copied, or visitors already chatting on a real page; dashboard previews are recorded with website "unknown").
  const progress = (knowledge as { setupProgress?: { previewTestedAt?: string; embedCopiedAt?: string } }).setupProgress ?? {}
  const widgetUsed = progress.embedCopiedAt
    ? true
    : Boolean(await (await getDb()).collection("conversations").findOne(
        { userId, website: { $nin: ["unknown", "", null] } },
        { projection: { _id: 1 } }
      ))
  const setup = {
    themeSaved: Boolean(knowledge.theme),
    previewTested: Boolean(progress.previewTestedAt),
    embedInstalled: widgetUsed,
  }

  if (!knowledge.url && !knowledge.theme) {
    return NextResponse.json({
      url: null,
      crawledAt: null,
      systemPrompt: null,
      theme: null,
      hasCrawled: false,
      setup,
    })
  }

  // Return everything EXCEPT content (too large)
  return NextResponse.json({
    url: knowledge.url || null,
    crawledAt: knowledge.crawledAt || null,
    systemPrompt: knowledge.systemPrompt || null,
    theme: knowledge.theme || null,
    hasCrawled: !!knowledge.url,
    chunkCount: knowledge.chunkCount || 0,
    pagesIndexed: knowledge.pagesIndexed || 0,
    setup,
  })
}
