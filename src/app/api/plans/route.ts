import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/plans';

/** Public: the active plans, for the pricing section and the account page. */
export async function GET() {
  const plans = await getPlans();
  return NextResponse.json(
    { plans },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
