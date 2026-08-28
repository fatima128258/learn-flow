import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  course: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

import app from '../server';

describe('API standards (Section 14)', () => {
  it('returns JSON 404 responses for unknown API routes', async () => {
    const res = await request(app).get('/api/v1/unknown/missing-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NOT_FOUND' });
  });

  it('applies rate limit headers to API responses', async () => {
    const res = await request(app).get('/api/v1/unknown/missing-route');

    expect(res.headers['x-ratelimit-limit']).toBe('300');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('keeps the health check unrate-limited', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('returns JSON 400 for malformed JSON request bodies', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'INVALID_JSON' });
  });

  it('includes the success flag on middleware authentication errors', async () => {
    const res = await request(app).get('/api/v1/organizations/org-a/courses');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'NOT_AUTHENTICATED' });
  });
});