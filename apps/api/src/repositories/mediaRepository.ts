import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateMediaData {
  id: string;
  organizationId: string;
  uploaderId: string;
  bucket: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export async function createMedia(data: CreateMediaData) {
  return prisma().media.create({
    data: {
      id: data.id,
      organizationId: data.organizationId,
      uploaderId: data.uploaderId,
      bucket: data.bucket,
      key: data.key,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: data.size,
    },
  });
}

export async function findById(organizationId: string, mediaId: string) {
  return prisma().media.findFirst({
    where: { id: mediaId, organizationId },
  });
}

export async function deleteById(organizationId: string, mediaId: string) {
  const result = await prisma().media.deleteMany({
    where: { id: mediaId, organizationId },
  });
  return result.count > 0;
}