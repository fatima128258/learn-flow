export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'application/octet-stream',
]);

export const ALLOWED_THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

export const MEDIA_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export function isAllowedMediaType(mimeType: string) {
  return ALLOWED_MEDIA_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isAllowedThumbnailType(mimeType: string) {
  return ALLOWED_THUMBNAIL_MIME_TYPES.has(mimeType.toLowerCase());
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};

export function extensionForContentType(mimeType: string) {
  return CONTENT_TYPE_EXTENSIONS[mimeType.toLowerCase()] ?? null;
}