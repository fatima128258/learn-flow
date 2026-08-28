export function sanitizeFileName(fileName: string) {
  const base = fileName.trim().replace(/[\\/]/g, '-').replace(/[\u0000-\u001f\u007f]/g, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'file';
}

export function mediaKey(organizationId: string, mediaId: string, fileName: string) {
  return `orgs/${organizationId}/media/${mediaId}/${sanitizeFileName(fileName)}`;
}

export function courseThumbnailKey(organizationId: string, courseId: string, extension: string) {
  return `orgs/${organizationId}/courses/${courseId}/thumbnail.${extension}`;
}

export function certificatePdfKey(organizationId: string, certificateId: string) {
  return `orgs/${organizationId}/certificates/${certificateId}/certificate.pdf`;
}