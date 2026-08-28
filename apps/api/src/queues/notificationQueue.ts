import { Queue } from 'bullmq';
import { getRedis } from '../utils/redis';

export const NOTIFICATION_QUEUE_NAME = 'notifications';

let queue: Queue | null = null;

export function isNotificationQueueEnabled() {
  return process.env.NODE_ENV !== 'test' && process.env.NOTIFICATIONS_QUEUE_ENABLED !== 'false';
}

export function getNotificationQueue() {
  if (!queue) {
    queue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
}
