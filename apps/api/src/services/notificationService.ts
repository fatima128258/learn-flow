import { NotificationType, Prisma } from '@prisma/client';
import * as notificationRepo from '../repositories/notificationRepository';

export interface NotifyParams {
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue | null;
  userId: string;
  organizationId: string;
}

function toNotificationDto(notification: any) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? null,
    read: Boolean(notification.readAt),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export async function notify(params: NotifyParams) {
  try {
    const notification = await notificationRepo.create({
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data,
      userId: params.userId,
      organizationId: params.organizationId,
    });
    return notification;
  } catch (err) {
    console.error('Failed to enqueue notification:', err);
    return null;
  }
}

export async function listStudentNotifications(
  organizationId: string,
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  const records = await notificationRepo.listByUser(userId, organizationId, {
    unreadOnly: options.unreadOnly,
    limit: options.limit,
  });
  return {
    notifications: records.map(toNotificationDto),
    unreadCount: await notificationRepo.countUnread(userId, organizationId),
  };
}

export async function markNotificationAsRead(
  organizationId: string,
  userId: string,
  notificationId: string,
) {
  const result = await notificationRepo.markAsRead(userId, organizationId, notificationId);
  if (result.count === 0) {
    throw new Error('NOTIFICATION_NOT_FOUND');
  }
  return notificationRepo.findByUserAndId(userId, organizationId, notificationId).then(toNotificationDto);
}

export async function markAllNotificationsAsRead(organizationId: string, userId: string) {
  await notificationRepo.markAllAsRead(userId, organizationId);
  return { success: true };
}

export async function getUnreadNotificationCount(organizationId: string, userId: string) {
  return { unreadCount: await notificationRepo.countUnread(userId, organizationId) };
}
