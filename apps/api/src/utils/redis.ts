import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://redis:6379';
    redis = new Redis(url);
  }
  return redis;
}

export default getRedis;
