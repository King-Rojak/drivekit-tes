/* ============================================================
   RATE LIMIT HELPER — In-Memory
   Untuk Vercel serverless: in-memory per instance.
   Cukup untuk mencegah abuse ringan.
   Untuk production besar, pakai Redis / Upstash.
============================================================ */

const buckets = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, data] of buckets.entries()) {
    if (now - data.lastAccess > 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key, limit, windowMs) {
  cleanup();

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { count: 0, resetAt: now + windowMs, lastAccess: now };
    buckets.set(key, bucket);
  }

  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.lastAccess = now;

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt
    };
  }

  bucket.count++;

  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt
  };
}
