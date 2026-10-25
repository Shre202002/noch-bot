/**
 * Small in-memory limiter for public forms, keyed by caller IP. State lives per server instance, which is enough to
 * stop a single client hammering a form; it is not a global quota.
 */
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 5, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim();
}
