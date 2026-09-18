import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
  }
  return redis;
}

export function waitForRedisReady(client: Redis, timeoutMs = 5000): Promise<void> {
  if (client.status === 'ready') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onEnd = () => {
      cleanup();
      reject(new Error('Redis connection ended before it became ready'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      client.removeListener('ready', onReady);
      client.removeListener('end', onEnd);
    };

    client.once('ready', onReady);
    client.once('end', onEnd);
  });
}

export default getRedis;
