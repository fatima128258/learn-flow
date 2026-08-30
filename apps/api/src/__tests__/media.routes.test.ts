import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  media: {
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../storage')>();
  return {
    ...original,
    putObject: vi.fn().mockResolvedValue({
      key: 'orgs/org-a/media/media-1/notes.pdf',
      publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    }),
    getPresignedUrl: vi.fn().mockResolvedValue('http://localhost:9000/signed/media.pdf'),
    deleteObjects: vi.fn().mockResolvedValue(undefined),
  };
});

import app from '../server';
import * as authService from '../services/authService';
import * as storage from '../storage';

const now = new Date('2026-08-28T12:00:00.000Z');

function membershipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-a',
    role: 'INSTRUCTOR',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mediaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-1',
    organizationId: 'org-a',
    uploaderId: 'user-1',
    bucket: 'learnflow',
    key: 'orgs/org-a/media/media-1/notes.pdf',
    fileName: 'notes.pdf',
    mimeType: 'application/pdf',
    size: 128,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function authenticateAs(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  options?: {
    userId?: string;
    organizationId?: string;
    emailVerified?: boolean;
  },
) {
  const userId = options?.userId ?? 'user-1';
  const organizationId = options?.organizationId ?? 'org-a';
  const emailVerified = options?.emailVerified ?? true;

  vi.mocked(authService.getSessionFromToken).mockResolvedValue({
    id: 'session-1',
    userId,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3600000),
    revoked: false,
    createdAt: now,
    updatedAt: now,
  });

  vi.mocked(authService.getUserById).mockResolvedValue({
    id: userId,
    name: 'Test User',
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: 'hash',
    emailVerified,
    createdAt: now,
    updatedAt: now,
  });

  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role, organizationId, userId },
  ]);

  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string } }) => {
    if (where?.role === 'PLATFORM_ADMIN') {
      return role === 'PLATFORM_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
  prismaMock.organization.findUnique.mockReset();
  prismaMock.media.create.mockReset();
  prismaMock.media.findFirst.mockReset();
  prismaMock.media.deleteMany.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
  vi.mocked(storage.putObject).mockReset();
  vi.mocked(storage.deleteObjects).mockReset();
  vi.mocked(storage.getPresignedUrl).mockReset();
  vi.mocked(storage.putObject).mockResolvedValue({
    key: 'orgs/org-a/media/media-1/notes.pdf',
    publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
  });
  vi.mocked(storage.getPresignedUrl).mockResolvedValue('http://localhost:9000/signed/media.pdf');
}

async function setValidAuth(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'INSTRUCTOR',
  options?: { userId?: string; organizationId?: string },
) {
  await authenticateAs(role, options);
  prismaMock.userOrganization.findUnique.mockResolvedValue(
    membershipRecord({
      role,
      userId: options?.userId ?? 'user-1',
      organizationId: options?.organizationId ?? 'org-a',
    }),
  );
}

const BASE = '/api/v1/organizations/org-a/media';

describe('POST /api/v1/organizations/:organizationId/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(BASE).attach('file', Buffer.from('data'), {
      filename: 'notes.pdf',
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with 403', async () => {
    await setValidAuth('STUDENT');
    const res = await request(app).post(BASE).set('Cookie', cookie()).attach(
      'file',
      Buffer.from('data'),
      { filename: 'notes.pdf', contentType: 'application/pdf' },
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('uploads a file and records the media object', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.media.create.mockResolvedValue(mediaRecord());

    const res = await request(app).post(BASE).set('Cookie', cookie()).attach(
      'file',
      Buffer.from('pdf-bytes'),
      { filename: 'notes.pdf', contentType: 'application/pdf' },
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      fileName: 'notes.pdf',
      mimeType: 'application/pdf',
    });
    expect(res.body.data.url).toContain('/learnflow/orgs/org-a/media/');
    expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('orgs/org-a/media/'),
        contentType: 'application/pdf',
      }),
    );
  });

  it('returns 400 when no file is attached', async () => {
    await setValidAuth('INSTRUCTOR');
    const res = await request(app).post(BASE).set('Cookie', cookie());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FILE');
  });

  it('rejects disallowed file types with 400', async () => {
    await setValidAuth('INSTRUCTOR');
    const res = await request(app).post(BASE).set('Cookie', cookie()).attach(
      'file',
      Buffer.from('<html></html>'),
      { filename: 'index.html', contentType: 'text/html' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('returns 403 for cross-tenant uploads', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/media')
      .set('Cookie', cookie())
      .attach('file', Buffer.from('data'), { filename: 'a.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

describe('GET /api/v1/organizations/:organizationId/media/:mediaId/url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns a signed URL for a member of the organization', async () => {
    await setValidAuth('STUDENT');
    prismaMock.media.findFirst.mockResolvedValue(mediaRecord());

    const res = await request(app).get(`${BASE}/media-1/url`).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.signedUrl).toBe('http://localhost:9000/signed/media.pdf');
    expect(res.body.data.fileName).toBe('notes.pdf');
  });

  it('returns 404 when the media does not exist', async () => {
    await setValidAuth('STUDENT');
    prismaMock.media.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/media-unknown/url`).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MEDIA_NOT_FOUND');
  });

  it('returns 403 for cross-tenant media access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/media/media-1/url')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

describe('DELETE /api/v1/organizations/:organizationId/media/:mediaId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('deletes the object and the media row', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.media.findFirst.mockResolvedValue(mediaRecord());
    prismaMock.media.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app).delete(`${BASE}/media-1`).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(storage.deleteObjects)).toHaveBeenCalledWith([
      'orgs/org-a/media/media-1/notes.pdf',
    ]);
    expect(prismaMock.media.deleteMany).toHaveBeenCalledWith({
      where: { id: 'media-1', organizationId: 'org-a' },
    });
  });

  it('returns 404 when the media does not exist', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.media.findFirst.mockResolvedValue(null);

    const res = await request(app).delete(`${BASE}/media-unknown`).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MEDIA_NOT_FOUND');
  });

  it('rejects students with 403', async () => {
    await setValidAuth('STUDENT');
    const res = await request(app).delete(`${BASE}/media-1`).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });
});