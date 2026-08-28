import { NotificationType, Prisma } from '@prisma/client';
import { getNotificationQueue, isNotificationQueueEnabled } from '../queues/notificationQueue';
import * as notificationService from './notificationService';
import { sendNotificationEmail } from '../utils/email';
import * as authService from './authService';

export interface NotificationJobData {
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue | null;
  userId: string;
  organizationId: string;
  email?: {
    to?: string;
    name?: string | null;
    courseTitle?: string | null;
    organizationName?: string | null;
    certificateUrl?: string;
  };
}

async function sendEmailForJob(job: NotificationJobData) {
  let email = job.email?.to;
  let name = job.email?.name;
  if (!email) {
    const user = await authService.getUserById(job.userId);
    email = user?.email;
    name = user?.name ?? name;
  }
  if (!email) return;

  const data = (job.data ?? {}) as Record<string, unknown>;

  await sendNotificationEmail(job.type, {
    to: email,
    name: name ?? null,
    courseTitle: job.email?.courseTitle ?? (typeof data.courseTitle === 'string' ? data.courseTitle : null),
    organizationName: job.email?.organizationName ?? (typeof data.organizationName === 'string' ? data.organizationName : null),
    certificateUrl: job.email?.certificateUrl ?? (typeof data.verificationUrl === 'string' ? data.verificationUrl : undefined),
  });
}

export async function processNotificationJob(job: NotificationJobData) {
  const result = await notificationService.notify({
    type: job.type,
    title: job.title,
    body: job.body,
    data: job.data,
    userId: job.userId,
    organizationId: job.organizationId,
  });

  try {
    await sendEmailForJob(job);
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }

  return result;
}

export async function dispatchNotification(job: NotificationJobData) {
  if (isNotificationQueueEnabled()) {
    try {
      await getNotificationQueue().add(NOTIFICATION_JOB_NAME, job);
      return true;
    } catch (err) {
      console.error('Notification queue unavailable, processing inline:', err);
    }
  }

  await processNotificationJob(job);
  return false;
}

export const NOTIFICATION_JOB_NAME = 'notification';
