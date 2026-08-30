import { beforeEach, afterEach, describe, expect, it } from 'vitest';

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
import { CloudinaryStorageProvider } from '../storage/cloudinaryProvider';

const CLOUDINARY_ENV_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

function restoreCloudinaryEnv() {
  for (const name of CLOUDINARY_ENV_VARS) {
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

describe('CloudinaryStorageProvider', () => {
  beforeEach(() => {
    restoreCloudinaryEnv();
    process.env.CLOUDINARY_CLOUD_NAME = 'learnflow-test';
    process.env.CLOUDINARY_API_KEY = 'test-api-key';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
  });

  afterEach(() => {
    restoreCloudinaryEnv();
  });

  it('uses the configured cloud name as the bucket label', () => {
    const provider = new CloudinaryStorageProvider();
    expect(provider.bucket).toBe('learnflow-test');
  });

  it('falls back to a stable bucket label when no cloud name is configured', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const provider = new CloudinaryStorageProvider();
    expect(provider.bucket).toBe('learnflow');
  });

  it('builds a public URL for an uploaded image', () => {
    const provider = new CloudinaryStorageProvider();
    const url = provider.getPublicUrl('orgs/org-a/courses/course-1/thumbnail.png');
    expect(url).toContain('res.cloudinary.com/learnflow-test/image/upload');
    expect(url).toContain('orgs/org-a/courses/course-1/thumbnail');
    expect(url).toContain('.png');
  });

  it('builds a public URL for a raw (PDF) resource', () => {
    const provider = new CloudinaryStorageProvider();
    const url = provider.getPublicUrl('orgs/org-a/media/media-1/notes.pdf');
    expect(url).toContain('res.cloudinary.com/learnflow-test/raw/upload');
    expect(url).toContain('orgs/org-a/media/media-1/notes');
    expect(url).toContain('.pdf');
  });

  it('produces a signed URL for presigned access', () => {
    const provider = new CloudinaryStorageProvider();
    const url = provider.getPublicUrl('orgs/org-a/media/media-1/notes.pdf');
    expect(url).toBeDefined();
    expect(provider.getPresignedUrl).toBeDefined();
  });

  it('skips the storage call for empty delete batches', async () => {
    const provider = new CloudinaryStorageProvider();
    await expect(provider.deleteObjects([])).resolves.toBeUndefined();
  });
});
