import { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0] || req.ip || 'unknown';
  return String(rawIp).trim() || 'unknown';
}

function setHeaders(res: Response, limit: number, remaining: number, resetAt: number) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 300;
  const store = new Map<string, Bucket>();

  const prune = (now: number) => {
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  };

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const key = `${req.method}:${req.path}:${clientIp(req)}`;
    const now = Date.now();
    prune(now);

    const bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      setHeaders(res, max, Math.max(0, max - 1), now + windowMs);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      setHeaders(res, max, 0, bucket.resetAt);
      return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
    }

    setHeaders(res, max, Math.max(0, max - bucket.count), bucket.resetAt);
    return next();
  };
}

export const apiRateLimiter = createRateLimiter({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.API_RATE_LIMIT_MAX ?? 300),
});