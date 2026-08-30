import getPrisma from '../prisma';
import { getRedis } from '../utils/redis';
import * as storage from '../storage';

const PROBE_TIMEOUT_MS = 1500;
const SERVICE_NAME = 'learnflow-api';
const SERVICE_VERSION = '1.0.0';

export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface HealthReport {
  status: 'ready' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
    objectStorage: DependencyStatus;
  };
}

function timed(probe: () => Promise<unknown>): Promise<{ latencyMs: number }> {
  const start = Date.now();
  return probe().then(() => ({ latencyMs: Date.now() - start }));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('PROBE_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function reportError(err: unknown): string {
  if (err instanceof Error && err.message === 'PROBE_TIMEOUT') return 'PROBE_TIMEOUT';
  return 'UNAVAILABLE';
}

async function probeDatabase(): Promise<DependencyStatus> {
  try {
    const { latencyMs } = await withTimeout(
      timed(() => getPrisma().$queryRawUnsafe('SELECT 1')),
      PROBE_TIMEOUT_MS,
    );
    return { status: 'up', latencyMs };
  } catch (err) {
    return { status: 'down', error: reportError(err) };
  }
}

async function probeRedis(): Promise<DependencyStatus> {
  try {
    const { latencyMs } = await withTimeout(
      timed(() => getRedis().ping()),
      PROBE_TIMEOUT_MS,
    );
    return { status: 'up', latencyMs };
  } catch (err) {
    return { status: 'down', error: reportError(err) };
  }
}

async function probeObjectStorage(): Promise<DependencyStatus> {
  try {
    const { latencyMs } = await withTimeout(
      timed(() => storage.storagePing()),
      PROBE_TIMEOUT_MS,
    );
    return { status: 'up', latencyMs };
  } catch (err) {
    return { status: 'down', error: reportError(err) };
  }
}

export async function collectHealthReport(): Promise<HealthReport> {
  const [database, redis, objectStorage] = await Promise.all([
    probeDatabase(),
    probeRedis(),
    probeObjectStorage(),
  ]);

  const allUp =
    database.status === 'up' && redis.status === 'up' && objectStorage.status === 'up';

  return {
    status: allUp ? 'ready' : 'degraded',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    dependencies: { database, redis, objectStorage },
  };
}