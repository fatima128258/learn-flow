import { Worker } from 'bullmq';
import { getRedis } from '../utils/redis';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordResetCodeEmail } from '../utils/email';
import { EMAIL_QUEUE_NAME, EmailJobData, isEmailQueueEnabled } from './emailQueue';

/**
 * Email Worker - processes email jobs from the queue in background
 * This allows the signup/password-reset endpoints to return immediately
 * without waiting for SMTP delivery (which can take 500ms-2s)
 */
export function createEmailWorker() {
  if (!isEmailQueueEnabled()) return null;

  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const data = job.data as EmailJobData;

      try {
        if (data.type === 'verification') {
          if (!data.token) throw new Error('MISSING_EMAIL_TOKEN');
          await sendVerificationEmail(data.email, data.token);
        } else if (data.type === 'password-reset') {
          if (!data.token) throw new Error('MISSING_EMAIL_TOKEN');
          await sendPasswordResetEmail(data.email, data.token);
        } else if (data.type === 'password-reset-code') {
          if (!data.code) throw new Error('MISSING_VERIFICATION_CODE');
          await sendPasswordResetCodeEmail(data.email, data.code);
        }
        return { success: true };
      } catch (err) {
        console.error(`Failed to send ${data.type} email to ${data.email}:`, err);
        // Re-throw to trigger retries (configured in queue)
        throw err;
      }
    },
    {
      connection: getRedis(),
      concurrency: 5, // Process up to 5 emails concurrently
    },
  );

  worker.on('completed', (job) => {
    console.log(`✓ Email job ${job.id} completed: ${(job.data as EmailJobData).type}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`✗ Email job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}
