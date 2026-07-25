// Fixed-window rate limiting, kept in memory rather than a database or Redis:
// this app has one small process, so a Map survives exactly as long as it
// needs to. It resets on redeploy, and on serverless it would be per-instance
// rather than global — fine for a personal site, worth revisiting with
// something like Upstash Redis if this ever runs across multiple instances.
const buckets = new Map();

// Swept opportunistically rather than on a timer, so idle traffic doesn't
// need a background job just to avoid the Map growing forever.
const MAX_BUCKETS = 5000;

/**
 * @param {string} key   unique per limiter + identity, e.g. "chat:1.2.3.4"
 * @param {{ limit: number, windowMs: number }} config
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Best-effort client IP from the headers a proxy/host sets — Next stopped
 * exposing request.ip directly, so this is the portable way to read it. */
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return request.headers.get("x-real-ip") ?? "unknown";
}
