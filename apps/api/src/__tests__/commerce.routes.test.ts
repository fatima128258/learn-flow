import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

import app from '../server';

describe('legacy commerce purchase endpoint', () => {
  it('cannot be used unauthenticated to bypass checkout and payment', async () => {
    const response = await request(app)
      .post('/api/v1/organizations/org-a/student/courses/course-1/purchase');

    expect(response.status).toBe(401);
  });
});
