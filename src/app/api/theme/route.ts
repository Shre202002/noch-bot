import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { readKnowledge, writeKnowledge } from "@/lib/storage";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId)
    return NextResponse.json(
      { error: "No userId" },
      { status: 400, headers: corsHeaders }
    );

  const knowledge = await readKnowledge(userId);

  // Priority: theme object → botColor fallback → null
  let theme = knowledge?.theme || null;

  if (!theme && knowledge?.botColor) {
    theme = {
      bubbleColor: knowledge.botColor,
      headerColor: knowledge.botColor,
      userMsgColor: knowledge.botColor,
      sendBtnColor: knowledge.botColor,
      accentColor: knowledge.botColor,
    };
  }

  console.log(`🎨 Theme GET for ${userId}:`, theme);

  return NextResponse.json(
    { theme },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );

  const { theme } = await req.json();

  // Partial update — sirf theme field update karo
  await writeKnowledge(userId, { theme });

  console.log(`🎨 Theme saved for ${userId}:`, theme);

  return NextResponse.json(
    { success: true },
    { headers: corsHeaders }
  );
}