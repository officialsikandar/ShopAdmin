import type express from 'express';
import { RateLimitBucket } from './models.ts';

export function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter(options: {
  scope: string;
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: express.Request) => string;
  message?: string;
}): express.RequestHandler {
  const { scope, windowMs, maxRequests, keyFn, message } = options;

  return async (req, res, next) => {
    try {
      const now = Date.now();
      const windowBucket = Math.floor(now / windowMs);
      const identifier = (keyFn ? keyFn(req) : getClientIp(req)) || 'anonymous';
      const bucketKey = `${scope}:${identifier}:${windowBucket}`;
      const expiresAt = new Date((windowBucket + 1) * windowMs + 5000);

      const bucket = await RateLimitBucket.findOneAndUpdate(
        { key: bucketKey },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt },
        },
        { upsert: true, new: true }
      ).lean();

      const count = Number(bucket?.count || 1);
      const remaining = Math.max(0, maxRequests - count);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((windowBucket + 1) * windowMs - now) / 1000)
      );

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));

      if (count > maxRequests) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: message || `Too many requests. Please try again in ${retryAfterSeconds}s.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds,
        });
      }

      next();
    } catch (err) {
      // Never block legitimate users on a transient rate-limiter error
      console.warn(`Rate limiter fallback (${scope}):`, err);
      next();
    }
  };
}
