import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set Meilisearch env for health checks
process.env.MEILISEARCH_HOST = 'http://localhost:7700';
process.env.MEILISEARCH_API_KEY = 'test-key';

// Mock fetch for Meilisearch health checks
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mocks = vi.hoisted(() => ({
  redisPing: vi.fn(async () => 'PONG' as string),
  storagePing: vi.fn(async () => undefined),
  databasePing: vi.fn(async () => [{ ok: 1 }]),
}));

vi.mock('../prisma', () => ({
  default: () => ({ $queryRawUnsafe: mocks.databasePing }),
}));

vi.mock('../utils/redis', () => ({
  getRedis: () => ({ ping: mocks.redisPing }),
}));

vi.mock('../storage', () => ({
  storagePing: mocks.storagePing,
}));

import app from '../server';

describe('Observability endpoints (Section 22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisPing.mockResolvedValue('PONG');
    mocks.storagePing.mockResolvedValue(undefined);
    // Mock Meilisearch health check to return success
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('exposes /api/health with all dependency statuses when everything is up', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('learnflow-api');
    expect(res.body.version).toBeDefined();
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.dependencies.database.status).toBe('up');
    expect(res.body.dependencies.redis.status).toBe('up');
    expect(res.body.dependencies.objectStorage.status).toBe('up');
    expect(res.body.dependencies.search.status).toBe('up');
  });

  it('exposes /api/ready and returns 200 only when all dependencies are available', async () => {
    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.dependencies).toEqual({
      database: expect.objectContaining({ status: 'up' }),
      redis: expect.objectContaining({ status: 'up' }),
      objectStorage: expect.objectContaining({ status: 'up' }),
      search: expect.objectContaining({ status: 'up' }),
    });
  });

  it('/api/ready returns 503 and reports the failing dependency when redis is down', async () => {
    mocks.redisPing.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.redis.status).toBe('down');
    expect(res.body.dependencies.database.status).toBe('up');
    expect(res.body.dependencies.objectStorage.status).toBe('up');
  });

  it('/api/ready returns 503 when the database is unavailable', async () => {
    mocks.databasePing.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body.dependencies.database.status).toBe('down');
  });

  it('/api/ready returns 503 when object storage is unavailable', async () => {
    mocks.storagePing.mockRejectedValueOnce(new Error('bucket unreachable'));

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body.dependencies.objectStorage.status).toBe('down');
  });

  it('/api/health stays 200 (liveness) even when a dependency is down', async () => {
    mocks.storagePing.mockRejectedValueOnce(new Error('bucket unreachable'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.objectStorage.status).toBe('down');
  });

  it('keeps both health endpoints unrate-limited and unauthenticated', async () => {
    const health = await request(app).get('/api/health');
    const ready = await request(app).get('/api/ready');

    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(health.headers['x-ratelimit-limit']).toBeUndefined();
    expect(ready.headers['x-ratelimit-limit']).toBeUndefined();
  });
});