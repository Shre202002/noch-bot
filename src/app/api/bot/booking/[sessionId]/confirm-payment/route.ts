import { NextRequest, NextResponse } from "next/server";

/**
 * DECOMMISSIONED SIMULATION ENDPOINT
 * 
 * This endpoint was used during Phase 3 development to simulate payment webhooks.
 * It is now disabled in favor of real-world idempotent webhooks in Phase 4.
 * Path: /api/payments/webhook/[provider]/[orgId]
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  return NextResponse.json({ 
    error: "Forbidden", 
    message: "Simulation endpoint is disabled. Use the production webhook endpoint for payment confirmation." 
  }, { status: 403 });
}
