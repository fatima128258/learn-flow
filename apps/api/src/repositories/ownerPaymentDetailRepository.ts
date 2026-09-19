import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

const selectFields = {
  id: true,
  organizationId: true,
  instructorUserId: true,
  courseId: true,
  bankName: true,
  accountTitle: true,
  accountNumber: true,
  iban: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findActiveForInstructor(organizationId: string, instructorUserId: string) {
  return prisma().ownerPaymentDetail.findFirst({
    where: { organizationId, instructorUserId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: selectFields,
  });
}

export function updateExisting(
  id: string,
  data: {
    bankName: string;
    accountTitle: string;
    accountNumber?: string;
    iban?: string;
  },
) {
  return prisma().ownerPaymentDetail.update({
    where: { id },
    data,
    select: selectFields,
  });
}

export async function saveForInstructor(
  organizationId: string,
  instructorUserId: string,
  data: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  },
) {
  const existing = await findActiveForInstructor(organizationId, instructorUserId);
  if (existing) {
    return updateExisting(existing.id, data);
  }

  return prisma().ownerPaymentDetail.create({
    data: {
      organizationId,
      instructorUserId,
      ...data,
    },
    select: selectFields,
  });
}
