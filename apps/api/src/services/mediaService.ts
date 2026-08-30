import crypto from 'crypto';
import * as storage from '../storage';
import * as mediaRepo from '../repositories/mediaRepository';

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function toMediaDto(media: {
  id: string;
  organizationId: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  return {
    id: media.id,
    organizationId: media.organizationId,
    uploaderId: media.uploaderId,
    fileName: media.fileName,
    mimeType: media.mimeType,
    size: media.size,
  };
}

export async function uploadMedia(
  organizationId: string,
  uploaderId: string,
  file: UploadedFileInput | undefined,
) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new Error('MISSING_FILE');
  }
  if (file.size > storage.MEDIA_MAX_SIZE_BYTES) {
    throw new Error('MEDIA_TOO_LARGE');
  }
  if (!storage.isAllowedMediaType(file.mimetype)) {
    throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  }
  if (storage.hasUnsafeExtension(file.originalname)) {
    throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  }

  const mediaId = crypto.randomUUID();
  const key = storage.mediaKey(organizationId, mediaId, file.originalname);

  const stored = await storage.putObject({
    key,
    data: file.buffer,
    contentType: file.mimetype,
  });

  try {
    const media = await mediaRepo.createMedia({
      id: mediaId,
      organizationId,
      uploaderId,
      bucket: storage.storageBucket(),
      key,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
    return { ...toMediaDto(media), url: stored.publicUrl };
  } catch (err) {
    await storage.deleteObjects([key]).catch(() => undefined);
    throw err;
  }
}

export async function getMediaSignedUrl(
  organizationId: string,
  mediaId: string,
): Promise<{ id: string; fileName: string; mimeType: string; size: number; url: string; signedUrl: string }> {
  const media = await mediaRepo.findById(organizationId, mediaId);
  if (!media) {
    throw new Error('MEDIA_NOT_FOUND');
  }

  const [signedUrl, url] = await Promise.all([
    storage.getPresignedUrl(media.key),
    storage.getPublicUrl(media.key).catch(() => ''),
  ]);

  return {
    id: media.id,
    fileName: media.fileName,
    mimeType: media.mimeType,
    size: media.size,
    url,
    signedUrl,
  };
}

export async function deleteMedia(organizationId: string, mediaId: string) {
  const media = await mediaRepo.findById(organizationId, mediaId);
  if (!media) {
    throw new Error('MEDIA_NOT_FOUND');
  }
  await storage.deleteObjects([media.key]);
  await mediaRepo.deleteById(organizationId, mediaId);
  return { success: true };
}