import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { NOTIFICATION_QUEUE_NAME } from './notificationQueue';
import { NOTIFICATION_JOB_NAME, processNotificationJob } from '../services/notificationDispatcher';

export function startNotificationWorker() {
  if (process.env.NODE_ENV === 'test') return null;

  const connection = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name === NOTIFICATION_JOB_NAME) {
        await processNotificationJob(job.data);
      }
    },
    {
      connection,
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
