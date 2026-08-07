import { HttpException, HttpStatus } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limit for public auth (and similar) endpoints.
 * Reads AUTH_THROTTLE_TTL (seconds, default 900) and AUTH_THROTTLE_LIMIT (default 20).
 * Falls back to THROTTLE_TTL when AUTH_THROTTLE_TTL is unset.
 */
export function assertAuthRateLimit(key: string): void {
  const ttlSec = Number.parseInt(
    process.env.AUTH_THROTTLE_TTL || process.env.THROTTLE_TTL || '900',
    10,
  );
  const limit = Number.parseInt(
    process.env.AUTH_THROTTLE_LIMIT || '20',
    10,
  );
  const now = Date.now();
  const windowMs = (Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : 900) * 1000;
  const max = Number.isFinite(limit) && limit > 0 ? limit : 20;

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= max) {
    throw new HttpException(
      'Too many attempts. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  existing.count += 1;
}

export function clientIpFromRequest(req: { ip?: string; headers?: Record<string, unknown> }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && typeof forwarded[0] === 'string') {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
