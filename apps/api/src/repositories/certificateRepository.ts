import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateCertificateData {
  certificateId: string;
  verificationToken: string;
  userId: string;
  courseId: string;
  organizationId: string;
  organizationName: string;
  instructorUserId: string;
  instructorName: string;
  studentName: string;
  courseTitle: string;
  completionDate: Date;
}

export async function findByUserAndCourse(userId: string, courseId: string) {
  return prisma().certificate.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  });
}

export async function findByVerificationToken(verificationToken: string) {
  return prisma().certificate.findUnique({
    where: { verificationToken },
  });
}

export async function findByUserAndCertificateId(userId: string, certificateId: string) {
  return prisma().certificate.findFirst({
    where: { userId, certificateId },
  });
}

export async function listByUserAndOrganization(userId: string, organizationId: string) {
  return prisma().certificate.findMany({
    where: { userId, organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCertificate(data: CreateCertificateData) {
  return prisma().certificate.create({
    data: {
      certificateId: data.certificateId,
      verificationToken: data.verificationToken,
      userId: data.userId,
      courseId: data.courseId,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      instructorUserId: data.instructorUserId,
      instructorName: data.instructorName,
      studentName: data.studentName,
      courseTitle: data.courseTitle,
      completionDate: data.completionDate,
    },
  });
}

export async function findByOrganizationAndCertificateId(
  organizationId: string,
  certificateId: string,
) {
  return prisma().certificate.findFirst({
    where: { certificateId, organizationId },
  });
}

export async function updatePdfUrl(id: string, pdfUrl: string) {
  return prisma().certificate.update({
    where: { id },
    data: { pdfUrl },
  });
}
