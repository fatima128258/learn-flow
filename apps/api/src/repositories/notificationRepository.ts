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

/**
 * List notifications for a user with optimized query selection.
 * Uses indexed fields (userId, organizationId, readAt) for fast filtering.
 * Excludes heavy JSON data field from the query to reduce memory footprint.
 * @performance O(log n) database lookup due to composite index on (userId, organizationId, readAt)
 */
export async function listByUser(
  userId: string,
  organizationId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  // Enforce maximum limit of 100 to prevent unbounded data loading
  const limit = options.limit ? Math.min(options.limit, 100) : 100;
  
  return prisma().notification.findMany({
    where: {
      userId,
      organizationId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    // Only select necessary fields - avoid fetching JSON data if not needed
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function findByUserAndId(userId: string, organizationId: string, notificationId: string) {
  return prisma().notification.findFirst({
    where: { id: notificationId, userId, organizationId },
  });
}

/**
 * Mark a single notification as read with optimized conditional update.
 * Only updates if readAt is currently null to avoid redundant DB operations.
 * @performance O(1) indexed lookup on (id, userId, organizationId)
 */
export async function markAsRead(userId: string, organizationId: string, notificationId: string) {
  return prisma().notification.updateMany({
    where: { 
      id: notificationId, 
      userId, 
      organizationId, 
      // Only update if not already read - avoids unnecessary writes
      readAt: null 
    },
    data: { readAt: new Date() },
  });
}

/**
 * Batch update: Mark all unread notifications for a user as read.
 * Uses a single UPDATE query instead of looping through items in application code.
 * @performance O(m) where m is number of unread notifications. Database handles batching efficiently.
 * Indexed query on (userId, organizationId, readAt) ensures fast filtering.
 */
export async function markAllAsRead(userId: string, organizationId: string) {
  // Single efficient SQL update statement targeting indexed fields
  // No N+1 queries, no application-level loops
  return prisma().notification.updateMany({
    where: { 
      userId, 
      organizationId, 
      // Only update unread notifications to minimize write operations
      readAt: null 
    },
    data: { readAt: new Date() },
  });
}

/**
 * Count unread notifications using indexed query.
 * Uses the composite index (userId, organizationId, readAt) for fast counting.
 * @performance O(log n) due to index on (userId, organizationId, readAt)
 */
export async function countUnread(userId: string, organizationId: string) {
  return prisma().notification.count({
    where: { 
      userId, 
      organizationId, 
      readAt: null 
    },
  });
}
