import { Queue } from 'bullmq';
import { getRedis } from '../utils/redis';

export const EMAIL_QUEUE_NAME = 'emails';

let queue: Queue | null = null;

export interface EmailJobData {
  type: 'verification' | 'password-reset' | 'password-reset-code';
  email: string;
  token?: string;
  code?: string;
}

export function isEmailQueueEnabled() {
  // Production deployments must opt in because BullMQ workers continuously
  // poll Redis and can exhaust request-based Redis plans.
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.NODE_ENV === 'production') {
    return process.env.EMAIL_QUEUE_ENABLED === 'true';
  }
  return process.env.EMAIL_QUEUE_ENABLED !== 'false';
}

export function getEmailQueue() {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 3600, // Keep successful jobs for 1 hour for audit
        removeOnFail: 86400, // Keep failed jobs for 24 hours
      },
    });
  }
  return queue;
}
