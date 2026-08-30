import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { minioClientMock } = vi.hoisted(() => ({
  minioClientMock: {
    bucketExists: vi.fn(),
    makeBucket: vi.fn(),
    setBucketPolicy: vi.fn(),
    putObject: vi.fn(),
    removeObjects: vi.fn(),
    presignedGetObject: vi.fn(),
  },
}));

vi.mock('minio', () => ({
  Client: vi.fn(() => minioClientMock),
}));

import { Client } from 'minio';
import {
  sanitizeFileName,
  mediaKey,
  courseThumbnailKey,
  certificatePdfKey,
} from '../storage/mediaKeys';
import {
  isAllowedMediaType,
  isAllowedThumbnailType,
  extensionForContentType,
  hasUnsafeExtension,
  MEDIA_MAX_SIZE_BYTES,
} from '../storage/mediaPolicy';
import { MinioStorageProvider } from '../storage/minioProvider';

const STORAGE_ENV_VARS = [
  'STORAGE_DRIVER',
  'STORAGE_ENDPOINT',
  'STORAGE_PORT',
  'STORAGE_USE_SSL',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_BUCKET',
  'STORAGE_REGION',
  'STORAGE_PUBLIC_URL',
];

function restoreStorageEnv() {
  for (const name of STORAGE_ENV_VARS) {
    delete process.env[name];
  }
}

describe('mediaKeys', () => {
  it('sanitizes file names for object keys', () => {
    expect(sanitizeFileName('My Notes (2).pdf')).toBe('My-Notes-2-.pdf');
    expect(sanitizeFileName('../secret.txt')).toBe('..-secret.txt');
    expect(sanitizeFileName('a\\b')).toBe('a-b');
    expect(sanitizeFileName('   ')).toBe('file');
  });

  it('scopes media keys under the organization', () => {
    expect(mediaKey('org-a', 'media-1', 'notes.pdf')).toBe(
      'orgs/org-a/media/media-1/notes.pdf',
    );
  });

  it('scopes course thumbnails under the organization and course', () => {
    expect(courseThumbnailKey('org-a', 'course-1', 'png')).toBe(
      'orgs/org-a/courses/course-1/thumbnail.png',
    );
  });

  it('scopes certificate PDFs under the organization and certificate', () => {
    expect(certificatePdfKey('org-a', 'CRT-ABC123')).toBe(
      'orgs/org-a/certificates/CRT-ABC123/certificate.pdf',
    );
  });
});

describe('mediaPolicy', () => {
  it('allows PDF and course-resource content types', () => {
    expect(isAllowedMediaType('application/pdf')).toBe(true);
    expect(isAllowedMediaType('text/markdown')).toBe(true);
    expect(isAllowedMediaType('application/zip')).toBe(true);
    expect(isAllowedMediaType('image/jpeg')).toBe(true);
  });

  it('rejects disallowed content types', () => {
    expect(isAllowedMediaType('text/html')).toBe(false);
    expect(isAllowedMediaType('application/x-sh')).toBe(false);
    expect(isAllowedThumbnailType('application/pdf')).toBe(false);
  });

  it('only allows images as course thumbnails', () => {
    expect(isAllowedThumbnailType('image/png')).toBe(true);
    expect(isAllowedThumbnailType('image/webp')).toBe(true);
    expect(isAllowedThumbnailType('application/pdf')).toBe(false);
  });

  it('maps content types to file extensions', () => {
    expect(extensionForContentType('image/png')).toBe('png');
    expect(extensionForContentType('application/pdf')).toBe('pdf');
    expect(extensionForContentType('application/octet-stream')).toBeNull();
  });

  it('enforces a maximum upload size', () => {
    expect(MEDIA_MAX_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });

  it('no longer treats application/octet-stream as an allowed upload type', () => {
    expect(isAllowedMediaType('application/octet-stream')).toBe(false);
  });

  it('flags executable and script extensions regardless of MIME type', () => {
    expect(hasUnsafeExtension('calc.exe')).toBe(true);
    expect(hasUnsafeExtension('shell.php')).toBe(true);
    expect(hasUnsafeExtension('run.sh')).toBe(true);
    expect(hasUnsafeExtension('payload.bat')).toBe(true);
    expect(hasUnsafeExtension('evil.svg')).toBe(true);
    expect(hasUnsafeExtension('dataset.json')).toBe(false);
  });

  it('flags unsafe extensions case-insensitively and when nested in the name', () => {
    expect(hasUnsafeExtension('PAYLOAD.EXE')).toBe(true);
    expect(hasUnsafeExtension('notes.tar.php')).toBe(true);
    expect(hasUnsafeExtension('notes.pdf')).toBe(false);
    expect(hasUnsafeExtension('no-extension')).toBe(false);
  });
});

describe('MinioStorageProvider', () => {
  beforeEach(() => {
    restoreStorageEnv();
    process.env.STORAGE_ENDPOINT = 'minio';
    process.env.STORAGE_PORT = '9000';
    process.env.STORAGE_ACCESS_KEY = 'test-key';
    process.env.STORAGE_SECRET_KEY = 'test-secret';
    process.env.STORAGE_BUCKET = 'learnflow';
    process.env.STORAGE_PUBLIC_URL = 'http://localhost:9000';

    vi.clearAllMocks();
    minioClientMock.bucketExists.mockResolvedValue(false);
    minioClientMock.makeBucket.mockResolvedValue(undefined);
    minioClientMock.setBucketPolicy.mockResolvedValue(undefined);
    minioClientMock.putObject.mockResolvedValue(undefined);
    minioClientMock.removeObjects.mockResolvedValue(undefined);
    minioClientMock.presignedGetObject.mockResolvedValue(
      'http://localhost:9000/signed/object',
    );
  });

  afterEach(() => {
    restoreStorageEnv();
  });

  it('constructs the S3-compatible client from environment configuration', () => {
    new MinioStorageProvider();

    const ClientMock = vi.mocked(Client);
    expect(ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endPoint: 'minio',
        port: 9000,
        useSSL: false,
        accessKey: 'test-key',
        secretKey: 'test-secret',
      }),
    );
  });

  it('builds public URLs from the configured base URL', () => {
    const provider = new MinioStorageProvider();
    expect(provider.bucket).toBe('learnflow');
    expect(provider.getPublicUrl('orgs/org-a/media/media-1/notes.pdf')).toBe(
      'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    );
  });

  it('throws when a public base URL is not configured', () => {
    delete process.env.STORAGE_PUBLIC_URL;
    const provider = new MinioStorageProvider();
    expect(() => provider.getPublicUrl('orgs/org-a/x')).toThrow(
      'STORAGE_PUBLIC_URL_NOT_CONFIGURED',
    );
  });

  it('uploads an object into object storage', async () => {
    const provider = new MinioStorageProvider();

    const result = await provider.putObject({
      key: 'orgs/org-a/courses/course-1/thumbnail.png',
      data: Buffer.from('png-bytes'),
      contentType: 'image/png',
    });

    expect(minioClientMock.bucketExists).toHaveBeenCalledWith('learnflow');
    expect(minioClientMock.makeBucket).toHaveBeenCalledWith('learnflow', 'us-east-1');
    expect(minioClientMock.putObject).toHaveBeenCalledWith(
      'learnflow',
      'orgs/org-a/courses/course-1/thumbnail.png',
      Buffer.from('png-bytes'),
      9,
      { 'Content-Type': 'image/png' },
    );
    expect(result).toEqual({
      key: 'orgs/org-a/courses/course-1/thumbnail.png',
      publicUrl:
        'http://localhost:9000/learnflow/orgs/org-a/courses/course-1/thumbnail.png',
    });
  });

  it('still uploads when setting the public-read policy fails', async () => {
    minioClientMock.setBucketPolicy.mockRejectedValue(new Error('policy denied'));

    const provider = new MinioStorageProvider();

    const result = await provider.putObject({
      key: 'orgs/org-a/media/media-1/notes.pdf',
      data: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
    });

    expect(result.key).toBe('orgs/org-a/media/media-1/notes.pdf');
  });

  it('returns a presigned URL for private objects', async () => {
    const provider = new MinioStorageProvider();

    const url = await provider.getPresignedUrl('orgs/org-a/media/media-1/notes.pdf', {
      expiresInSeconds: 300,
    });

    expect(minioClientMock.presignedGetObject).toHaveBeenCalledWith(
      'learnflow',
      'orgs/org-a/media/media-1/notes.pdf',
      300,
    );
    expect(url).toBe('http://localhost:9000/signed/object');
  });

  it('deletes a batch of objects by key', async () => {
    const provider = new MinioStorageProvider();

    await provider.deleteObjects(['orgs/org-a/a', 'orgs/org-a/b']);

    expect(minioClientMock.removeObjects).toHaveBeenCalledWith('learnflow', [
      'orgs/org-a/a',
      'orgs/org-a/b',
    ]);
  });

  it('skips the storage call for empty delete batches', async () => {
    const provider = new MinioStorageProvider();

    await provider.deleteObjects([]);

    expect(minioClientMock.removeObjects).not.toHaveBeenCalled();
  });
});

describe('storage driver selection', () => {
  beforeEach(() => {
    restoreStorageEnv();
    process.env.STORAGE_ENDPOINT = 'localhost';
    process.env.STORAGE_PORT = '9000';
    process.env.STORAGE_ACCESS_KEY = 'minioadmin';
    process.env.STORAGE_SECRET_KEY = 'minioadmin';
    process.env.STORAGE_BUCKET = 'learnflow';
    process.env.STORAGE_REGION = 'us-east-1';
    process.env.STORAGE_PUBLIC_URL = 'http://localhost:9000';

    vi.clearAllMocks();
    minioClientMock.bucketExists.mockResolvedValue(true);
    minioClientMock.putObject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    restoreStorageEnv();
  });

  async function freshStorage() {
    vi.resetModules();
    return import('../storage');
  }

  it('maps S3, MinIO and R2 drivers to the S3-compatible provider', async () => {
    for (const driver of ['s3', 'minio', 'r2']) {
      process.env.STORAGE_DRIVER = driver;
      const storage = await freshStorage();

      const result = await storage.putObject({
        key: 'orgs/org-a/media/media-1/notes.pdf',
        data: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
      });

      expect(result.key).toBe('orgs/org-a/media/media-1/notes.pdf');
    }
  });

  it('rejects unsupported storage drivers', async () => {
    process.env.STORAGE_DRIVER = 'azure';
    const storage = await freshStorage();

    await expect(
      storage.putObject({
        key: 'orgs/org-a/media/media-1/notes.pdf',
        data: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('UNSUPPORTED_STORAGE_DRIVER');
  });
});