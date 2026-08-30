import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  evalsha: vi.fn(),
  script: vi.fn(),
  ping: vi.fn(async () => 'PONG'),
}));

vi.mock('../utils/redis', () => ({
  getRedis: () => redisMock,
}));

import { createRateLimiter } from '../middleware/rateLimit';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildApp(options: Parameters<typeof createRateLimiter>[0] = {}) {
  const limiter = createRateLimiter(options);
  const app = express();
  app.use(limiter);
  app.get('/resource', (_req, res) => res.json({ success: true, data: 'ok' }));
  app.get('/other', (_req, res) => res.json({ success: true, data: 'other' }));
  return app;
}

describe('createRateLimiter middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.script.mockResolvedValue('mock_sha');
    redisMock.evalsha.mockResolvedValue([1, 1, Math.ceil((Date.now() + 60000) / 1000), 5]);
  });

  it('allows requests up to the configured maximum and rejects the next with 429', async () => {
    redisMock.evalsha
      .mockResolvedValueOnce([1, 1, Math.ceil((Date.now() + 60000) / 1000), 2]) // first request
      .mockResolvedValueOnce([1, 2, Math.ceil((Date.now() + 60000) / 1000), 2]) // second request
      .mockResolvedValueOnce([0, 3, Math.ceil((Date.now() + 60000) / 1000), 2]); // third request (rejected)

    const app = buildApp({ windowMs: 60_000, max: 2 });

    const first = await request(app).get('/resource');
    const second = await request(app).get('/resource');
    const rejected = await request(app).get('/resource');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(rejected.status).toBe(429);
    expect(rejected.body).toEqual({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  });

  it('exposes standard rate limit headers on successful responses', async () => {
    redisMock.evalsha.mockResolvedValue([1, 1, Math.ceil((Date.now() + 60000) / 1000), 5]);

    const app = buildApp({ windowMs: 60_000, max: 5 });

    const res = await request(app).get('/resource');

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('includes Retry-After when a request is rejected', async () => {
    redisMock.evalsha
      .mockResolvedValueOnce([1, 1, Math.ceil((Date.now() + 60000) / 1000), 1])
      .mockResolvedValueOnce([0, 2, Math.ceil((Date.now() + 60000) / 1000), 1]);

    const app = buildApp({ windowMs: 60_000, max: 1 });

    await request(app).get('/resource');
    const rejected = await request(app).get('/resource');

    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(rejected.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('does not consume quota for preflight OPTIONS requests', async () => {
    const app = buildApp({ windowMs: 60_000, max: 1 });

    await request(app).options('/resource');
    const res = await request(app).get('/resource');

    expect(res.status).toBe(200);
  });

  it('tracks limits independently per route', async () => {
    let callCount = 0;
    redisMock.evalsha.mockImplementation(() => {
      callCount++;
      if (callCount === 1 || callCount === 2) {
        return Promise.resolve([1, callCount, Math.ceil((Date.now() + 60000) / 1000), 1]);
      }
      return Promise.resolve([0, 2, Math.ceil((Date.now() + 60000) / 1000), 1]);
    });

    const app = buildApp({ windowMs: 60_000, max: 1 });

    const resource = await request(app).get('/resource');
    const other = await request(app).get('/other');
    const resourceAgain = await request(app).get('/resource');

    expect(resource.status).toBe(200);
    expect(other.status).toBe(200);
    expect(resourceAgain.status).toBe(429);
  });

  it('resets the quota after the window elapses', async () => {
    redisMock.evalsha
      .mockResolvedValueOnce([1, 1, Math.ceil((Date.now() + 50) / 1000), 1])
      .mockResolvedValueOnce([0, 2, Math.ceil((Date.now() + 50) / 1000), 1])
      .mockResolvedValueOnce([1, 1, Math.ceil((Date.now() + 50) / 1000), 1]);

    const app = buildApp({ windowMs: 50, max: 1 });

    await request(app).get('/resource');
    const rejected = await request(app).get('/resource');
    await sleep(80);
    const allowed = await request(app).get('/resource');

    expect(rejected.status).toBe(429);
    expect(allowed.status).toBe(200);
  });
});