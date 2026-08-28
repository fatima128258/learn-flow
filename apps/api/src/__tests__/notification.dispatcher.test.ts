import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queueMock, emailMock, authMock, notifServiceMock } = vi.hoisted(() => ({
  queueMock: {
    isNotificationQueueEnabled: vi.fn(),
    getNotificationQueue: vi.fn(),
    NOTIFICATION_QUEUE_NAME: 'notifications',
  },
  emailMock: {
    sendNotificationEmail: vi.fn(),
  },
  authMock: {
    getUserById: vi.fn(),
  },
  notifServiceMock: {
    notify: vi.fn(),
  },
}));

vi.mock('../queues/notificationQueue', () => queueMock);
vi.mock('../utils/email', () => emailMock);
vi.mock('../services/authService', () => authMock);
vi.mock('../services/notificationService', () => notifServiceMock);

import {
  dispatchNotification,
  processNotificationJob,
  NOTIFICATION_JOB_NAME,
} from '../services/notificationDispatcher';

const baseJob = {
  type: 'ENROLLMENT_CONFIRMATION' as const,
  title: 'Enrolled in Course',
  body: 'You are enrolled.',
  userId: 'user-1',
  organizationId: 'org-a',
};

function resetMocks() {
  queueMock.isNotificationQueueEnabled.mockReset();
  queueMock.getNotificationQueue.mockReset();
  emailMock.sendNotificationEmail.mockReset();
  authMock.getUserById.mockReset();
  notifServiceMock.notify.mockReset();
}

describe('dispatchNotification (background processing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('enqueues the notification job to BullMQ when the queue is enabled', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    queueMock.isNotificationQueueEnabled.mockReturnValue(true);
    queueMock.getNotificationQueue.mockReturnValue({ add });

    const result = await dispatchNotification({ ...baseJob });

    expect(result).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    const [jobName, payload] = add.mock.calls[0];
    expect(jobName).toBe(NOTIFICATION_JOB_NAME);
    expect(payload).toEqual(expect.objectContaining({ type: 'ENROLLMENT_CONFIRMATION', userId: 'user-1' }));
  });

  it('falls back to synchronous in-app processing when the queue is disabled', async () => {
    queueMock.isNotificationQueueEnabled.mockReturnValue(false);
    notifServiceMock.notify.mockResolvedValue({ id: 'notif-1' });

    const result = await dispatchNotification({ ...baseJob });

    expect(result).toBe(false);
    expect(queueMock.getNotificationQueue).not.toHaveBeenCalled();
    expect(notifServiceMock.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ENROLLMENT_CONFIRMATION', userId: 'user-1' }),
    );
  });

  it('falls back to synchronous processing when the queue add rejects', async () => {
    const add = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    queueMock.isNotificationQueueEnabled.mockReturnValue(true);
    queueMock.getNotificationQueue.mockReturnValue({ add });
    notifServiceMock.notify.mockResolvedValue(null);

    const result = await dispatchNotification({ ...baseJob });

    expect(result).toBe(false);
    expect(notifServiceMock.notify).toHaveBeenCalled();
  });
});

describe('processNotificationJob (worker handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('creates an in-app notification with job data', async () => {
    notifServiceMock.notify.mockResolvedValue({ id: 'notif-1' });
    emailMock.sendNotificationEmail.mockResolvedValue(true);

    const result = await processNotificationJob({ ...baseJob });

    expect(notifServiceMock.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ENROLLMENT_CONFIRMATION',
        title: 'Enrolled in Course',
        userId: 'user-1',
        organizationId: 'org-a',
      }),
    );
    expect(result).toEqual({ id: 'notif-1' });
  });

  it('sends a notification email using the user email and event type', async () => {
    notifServiceMock.notify.mockResolvedValue({ id: 'notif-1' });
    authMock.getUserById.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.com',
      name: 'Student User',
    });
    emailMock.sendNotificationEmail.mockResolvedValue(true);

    await processNotificationJob({ ...baseJob, data: { courseTitle: 'React' } });

    expect(authMock.getUserById).toHaveBeenCalledWith('user-1');
    expect(emailMock.sendNotificationEmail).toHaveBeenCalledWith(
      'ENROLLMENT_CONFIRMATION',
      expect.objectContaining({ to: 'student@example.com', name: 'Student User' }),
    );
  });
});
