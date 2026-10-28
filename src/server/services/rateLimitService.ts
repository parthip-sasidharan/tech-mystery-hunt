/**
 * src/server/services/rateLimitService.ts
 *
 * In-memory sliding-window rate limiter for QR scanning and riddle answer attempts.
 * Prevents high-frequency brute-forcing, automated token replay, and DoS attacks.
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const qrScanBuckets = new Map<string, RateBucket>();
const answerBuckets = new Map<string, RateBucket>();

/**
 * Checks and increments QR scan attempt rate for a specific team.
 * Limit: Max 25 scan attempts per 20-second rolling window.
 */
export function checkQrScanRateLimit(teamId: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const windowMs = 20 * 1000;
  const maxAttempts = 25;

  const bucket = qrScanBuckets.get(teamId);
  if (!bucket || now > bucket.resetAt) {
    qrScanBuckets.set(teamId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  bucket.count++;
  if (bucket.count > maxAttempts) {
    const waitSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

/**
 * Checks and increments answer submission rate for a specific team on a checkpoint.
 * Limit: Max 15 answer attempts per 20-second window per checkpoint.
 */
export function checkAnswerRateLimit(
  teamId: string,
  checkpointId: string
): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const windowMs = 20 * 1000;
  const maxAttempts = 15;

  const key = `${teamId}_${checkpointId}`;
  const bucket = answerBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    answerBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  bucket.count++;
  if (bucket.count > maxAttempts) {
    const waitSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

/**
 * Resets rate limit buckets for testing or administrator override.
 */
export function resetRateLimits() {
  qrScanBuckets.clear();
  answerBuckets.clear();
}
