import { performance } from 'perf_hooks';
import getPrisma from '../prisma';

const SAMPLE_COUNT = 10;

export interface TimingSummary {
  samples: number;
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

function roundMs(value: number) {
  return Number(value.toFixed(2));
}

function summarize(values: number[]): TimingSummary {
  if (values.length === 0) {
    throw new Error('NO_DIAGNOSTIC_SAMPLES');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];

  return {
    samples: values.length,
    minMs: roundMs(sorted[0]),
    avgMs: roundMs(values.reduce((total, value) => total + value, 0) / values.length),
    p50Ms: roundMs(percentile(0.5)),
    p95Ms: roundMs(percentile(0.95)),
    maxMs: roundMs(sorted[sorted.length - 1]),
  };
}

async function measure<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  await operation();
  return performance.now() - startedAt;
}

async function measureSamples<T>(operation: () => Promise<T>) {
  const timings: number[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    timings.push(await measure(operation));
  }
  return summarize(timings);
}

function getDatabaseTopology() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL_NOT_CONFIGURED');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL_INVALID');
  }

  const hostname = parsed.hostname;
  const poolerDetected = parsed.port === '6543'
    || /pooler|supavisor|pgbouncer/i.test(hostname)
    || parsed.searchParams.has('pgbouncer');

  return {
    databaseHost: hostname,
    databasePort: parsed.port || (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:' ? '5432' : 'unknown'),
    connectionType: poolerDetected ? 'pooled' : 'direct_or_unknown',
    poolerDetected,
    relevantParameters: ['connection_limit', 'pool_timeout', 'connect_timeout', 'pgbouncer', 'sslmode']
      .filter((key) => parsed.searchParams.has(key)),
  };
}

export async function collectDatabaseLatencyDiagnostics() {
  const prisma = getPrisma();

  const select1 = await measureSamples(() => prisma.$queryRaw`SELECT 1`);
  const prismaQuery = await measureSamples(() => prisma.userOrganization.findFirst({
    select: { id: true },
  }));

  return {
    runtimeRegion: process.env.RENDER_REGION || 'unknown',
    ...getDatabaseTopology(),
    connectionEstablishment: {
      available: false,
      reason: 'Not measured: creating additional production connections is intentionally avoided.',
    },
    select1,
    prisma: prismaQuery,
  };
}
