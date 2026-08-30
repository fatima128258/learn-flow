import { NextFunction, Request, Response } from 'express';
import { getRedis } from '../utils/redis';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
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

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_start = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)

if count >= limit then
  local ttl = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset_at = 0
  if #ttl > 0 then
    reset_at = math.ceil((tonumber(ttl[2]) + window - now) / 1000)
  else
    reset_at = math.ceil(window / 1000)
  end
  return {0, count, reset_at, limit}
end

redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
redis.call('PEXPIRE', key, window)
return {1, count + 1, math.ceil((now + window) / 1000), limit}
`;

let rateLimitSha: string | null = null;

async function ensureScriptLoaded(redis: ReturnType<typeof getRedis>): Promise<string> {
  if (!rateLimitSha) {
    const sha = await redis.script('LOAD', RATE_LIMIT_SCRIPT) as string;
    if (!sha) throw new Error('Failed to load rate limit script');
    rateLimitSha = sha;
  }
  return rateLimitSha;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 300;
  const keyPrefix = options.keyPrefix ?? 'rl:api';

  return async function rateLimit(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const ip = clientIp(req);
    const key = `${keyPrefix}:${req.method}:${req.path}:${ip}`;
    const now = Date.now();

    try {
      const redis = getRedis();
      const sha = await ensureScriptLoaded(redis);

      const result = await redis.evalsha(sha, 1, key, windowMs.toString(), max.toString(), now.toString()) as [number, number, number, number];

      const [allowed, count, resetAt, limit] = result;
      const remaining = Math.max(0, limit - count);

      setHeaders(res, limit, remaining, resetAt);

      if (!allowed) {
        const retryAfter = Math.max(1, Math.ceil((resetAt * 1000 - now) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
      }

      return next();
    } catch (err) {
      // On Redis failure, fail open with a warning log but do not silently disable
      // In production, consider failing closed; here we log and allow the request
      // to avoid a Redis outage causing total service denial.
      console.error('[rateLimit] Redis error, failing open:', err instanceof Error ? err.message : err);
      setHeaders(res, max, max, now + windowMs);
      return next();
    }
  };
}

export const apiRateLimiter = createRateLimiter({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.API_RATE_LIMIT_MAX ?? 300),
  keyPrefix: 'rl:api',
});