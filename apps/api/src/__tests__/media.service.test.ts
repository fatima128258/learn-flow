import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mediaRepoMock, storageMock } = vi.hoisted(() => ({
  mediaRepoMock: {
    createMedia: vi.fn(),
    findById: vi.fn(),
    deleteById: vi.fn(),
  },
  storageMock: {
    MEDIA_MAX_SIZE_BYTES: 1024,
    isAllowedMediaType: vi.fn(),
    isAllowedThumbnailType: vi.fn(),
    mediaKey: vi.fn(() => 'orgs/org-a/media/media-1/notes.pdf'),
    storageBucket: vi.fn(() => 'learnflow'),
    putObject: vi.fn(),
    deleteObjects: vi.fn(),
    getPresignedUrl: vi.fn(),
    getPublicUrl: vi.fn(),
  },
}));

vi.mock('../repositories/mediaRepository', () => mediaRepoMock);
vi.mock('../storage', () => storageMock);

import * as mediaService from '../services/mediaService';

function file(overrides: Record<string, unknown> = {}) {
  return {
    originalname: 'notes.pdf',
    mimetype: 'application/pdf',
    size: 128,
    buffer: Buffer.from('pdf-bytes'),
    ...overrides,
  };
}

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-1',
    organizationId: 'org-a',
    uploaderId: 'user-1',
    bucket: 'learnflow',
    key: 'orgs/org-a/media/media-1/notes.pdf',
    fileName: 'notes.pdf',
    mimeType: 'application/pdf',
    size: 128,
    ...overrides,
  };
}

describe('mediaService.uploadMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageMock.isAllowedMediaType).mockReturnValue(true);
    vi.mocked(storageMock.putObject).mockResolvedValue({
      key: 'orgs/org-a/media/media-1/notes.pdf',
      publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    });
    vi.mocked(storageMock.deleteObjects).mockResolvedValue(undefined);
    vi.mocked(mediaRepoMock.createMedia).mockResolvedValue(mediaRow());
  });

  it('stores the file and records the media object', async () => {
    const result = await mediaService.uploadMedia('org-a', 'user-1', file());

    expect(result).toMatchObject({
      id: 'media-1',
      fileName: 'notes.pdf',
      mimeType: 'application/pdf',
      size: 128,
      url: 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    });
    expect(storageMock.putObject).toHaveBeenCalledWith({
      key: 'orgs/org-a/media/media-1/notes.pdf',
      data: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
    });
    expect(mediaRepoMock.createMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        uploaderId: 'user-1',
        bucket: 'learnflow',
        fileName: 'notes.pdf',
      }),
    );
  });

  it('throws MISSING_FILE when no file is provided', async () => {
    await expect(mediaService.uploadMedia('org-a', 'user-1', undefined)).rejects.toThrow(
      'MISSING_FILE',
    );
  });

  it('throws MEDIA_TOO_LARGE when the file exceeds the size limit', async () => {
    await expect(
      mediaService.uploadMedia('org-a', 'user-1', file({ size: 4096 })),
    ).rejects.toThrow('MEDIA_TOO_LARGE');
    expect(storageMock.putObject).not.toHaveBeenCalled();
  });

  it('throws MEDIA_TYPE_NOT_ALLOWED for disallowed types', async () => {
    vi.mocked(storageMock.isAllowedMediaType).mockReturnValue(false);
    await expect(
      mediaService.uploadMedia('org-a', 'user-1', file()),
    ).rejects.toThrow('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('cleans up the stored object when the media row cannot be created', async () => {
    vi.mocked(mediaRepoMock.createMedia).mockRejectedValue(new Error('db down'));

    await expect(mediaService.uploadMedia('org-a', 'user-1', file())).rejects.toThrow('db down');
    expect(storageMock.deleteObjects).toHaveBeenCalledWith(['orgs/org-a/media/media-1/notes.pdf']);
  });
});

describe('mediaService.getMediaSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageMock.getPublicUrl).mockResolvedValue(
      'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    );
  });

  it('throws MEDIA_NOT_FOUND when the media does not exist in the organization', async () => {
    vi.mocked(mediaRepoMock.findById).mockResolvedValue(null);

    await expect(mediaService.getMediaSignedUrl('org-a', 'media-1')).rejects.toThrow(
      'MEDIA_NOT_FOUND',
    );
  });

  it('returns a fresh signed URL for the object', async () => {
    vi.mocked(mediaRepoMock.findById).mockResolvedValue(mediaRow());
    vi.mocked(storageMock.getPresignedUrl).mockResolvedValue('http://localhost:9000/signed/pdf');

    const result = await mediaService.getMediaSignedUrl('org-a', 'media-1');

    expect(result.signedUrl).toBe('http://localhost:9000/signed/pdf');
    expect(storageMock.getPresignedUrl).toHaveBeenCalledWith('orgs/org-a/media/media-1/notes.pdf');
    expect(mediaRepoMock.findById).toHaveBeenCalledWith('org-a', 'media-1');
  });
});

describe('mediaService.deleteMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws MEDIA_NOT_FOUND when the media does not exist', async () => {
    vi.mocked(mediaRepoMock.findById).mockResolvedValue(null);

    await expect(mediaService.deleteMedia('org-a', 'media-1')).rejects.toThrow('MEDIA_NOT_FOUND');
  });

  it('removes the object and the media row', async () => {
    vi.mocked(mediaRepoMock.findById).mockResolvedValue(mediaRow());
    vi.mocked(mediaRepoMock.deleteById).mockResolvedValue(true);

    const result = await mediaService.deleteMedia('org-a', 'media-1');

    expect(result).toEqual({ success: true });
    expect(storageMock.deleteObjects).toHaveBeenCalledWith(['orgs/org-a/media/media-1/notes.pdf']);
    expect(mediaRepoMock.deleteById).toHaveBeenCalledWith('org-a', 'media-1');
  });
});