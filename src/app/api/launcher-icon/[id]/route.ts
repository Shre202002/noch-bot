import { NextRequest, NextResponse } from "next/server";
import { renderLauncherIcon } from "@/lib/launcherIconArt";

export const dynamic = "force-dynamic";

// GET /api/launcher-icon/[id]?color=RRGGBB
// A chat icon drawn in the chatbot's theme colour. The widget on other websites shows it as an ordinary image, so the
// colour is applied here, on our side. Only a validated six-digit colour ever reaches the markup; a missing or invalid
// colour gives the original artwork.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svg = renderLauncherIcon(id, req.nextUrl.searchParams.get("color"));
  if (!svg) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
      // If the image is opened directly it can show itself but do nothing else.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
