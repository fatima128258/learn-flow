import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
  loginUser: vi.fn(async () => {
    throw new Error('INVALID_CREDENTIALS');
  }),
}));

import app from '../server';
import {
  isAllowedMediaType,
  isAllowedThumbnailType,
  extensionForContentType,
} from '../storage';

describe('Security headers (Section 16)', () => {
  it('sends hardening headers on API responses', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['permissions-policy']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('only sends HSTS when cookies are marked secure', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('CSRF origin validation (Section 16)', () => {
  it('rejects a state-changing request from a foreign origin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://evil.example')
      .send({ email: 'a@b.com', password: 'password' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'CSRF_ORIGIN_REJECTED' });
  });

  it('allows a state-changing request from an allowlisted origin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'a@b.com', password: 'password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('allows requests without an Origin header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('does not block safe methods', async () => {
    const res = await request(app)
      .get('/api/v1/unknown/missing-route')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NOT_FOUND' });
  });
});

describe('Request body size limit (Section 16)', () => {
  it('rejects JSON bodies larger than the configured limit', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"data":"${'a'.repeat(1100000)}"}`);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, error: 'PAYLOAD_TOO_LARGE' });
  });
});

describe('Malicious file uploads - SVG blocked (Section 16)', () => {
  it('does not allow SVG uploads as media', () => {
    expect(isAllowedMediaType('image/svg+xml')).toBe(false);
    expect(isAllowedMediaType('image/png')).toBe(true);
  });

  it('does not allow SVG uploads as thumbnails', () => {
    expect(isAllowedThumbnailType('image/svg+xml')).toBe(false);
    expect(isAllowedThumbnailType('image/webp')).toBe(true);
  });

  it('returns no extension mapping for SVG', () => {
    expect(extensionForContentType('image/svg+xml')).toBeNull();
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
  });
});