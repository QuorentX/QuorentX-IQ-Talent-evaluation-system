/** Simple in-memory rate limiter for unauthenticated bootstrap endpoints. */
const hits = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now > row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  row.count += 1;
  if (row.count > limit) {
    throw new Error("Too many attempts. Please wait and try again.");
  }
}
