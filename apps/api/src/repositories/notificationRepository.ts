import getPrisma from '../prisma';
import { NotificationType, Prisma } from '@prisma/client';

function prisma() {
  return getPrisma();
}

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue | null;
  userId: string;
  organizationId: string;
}

export async function create(data: CreateNotificationData) {
  return prisma().notification.create({
    data: {
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      data: data.data ?? undefined,
      userId: data.userId,
      organizationId: data.organizationId,
    },
  });
}

export async function listByUser(
  userId: string,
  organizationId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  return prisma().notification.findMany({
    where: {
      userId,
      organizationId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
  });
}

export async function findByUserAndId(userId: string, organizationId: string, notificationId: string) {
  return prisma().notification.findFirst({
    where: { id: notificationId, userId, organizationId },
  });
}

export async function markAsRead(userId: string, organizationId: string, notificationId: string) {
  return prisma().notification.updateMany({
    where: { id: notificationId, userId, organizationId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string, organizationId: string) {
  return prisma().notification.updateMany({
    where: { userId, organizationId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function countUnread(userId: string, organizationId: string) {
  return prisma().notification.count({
    where: { userId, organizationId, readAt: null },
  });
}
