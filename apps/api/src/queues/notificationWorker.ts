import { Worker } from 'bullmq';
import { isNotificationQueueEnabled, NOTIFICATION_QUEUE_NAME } from './notificationQueue';
import { NOTIFICATION_JOB_NAME, processNotificationJob } from '../services/notificationDispatcher';
import { getRedis } from '../utils/redis';

export function startNotificationWorker() {
  if (!isNotificationQueueEnabled()) return null;

  const worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name === NOTIFICATION_JOB_NAME) {
        await processNotificationJob(job.data);
      }
    },
    {
      // Reuse the application's Redis client so workers inherit its bounded
      // reconnect policy instead of creating an unbounded reconnect loop.
      connection: getRedis(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });

  return worker;
}
