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

export default getRedis;
