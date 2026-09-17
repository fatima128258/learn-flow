export interface AuthPerfContext {
  requestId: string;
  startedAt: number;
  redisLimiterMs?: number;
  redisLoginMs?: number;
  dbUserLookupMs?: number;
  argon2Ms?: number;
  membershipMs?: number;
  sessionMs?: number;
  auditLogMs?: number;
  redisCleanupMs?: number;
  responseGenerationMs?: number;
}

export function now() {
  return performance.now();
}

export function durationMs(start: number) {
  return Number((now() - start).toFixed(2));
}

export function logAuthPerf(requestId: string, stage: string, durationMsValue: number) {
  console.log(`[AUTH_PERF] request=${requestId} stage=${stage} durationMs=${durationMsValue}`);
}

export function logAuthPerfSummary(context: AuthPerfContext, totalBackendMs: number) {
  console.log(
    `[AUTH_PERF_SUMMARY] request=${context.requestId} `
    + `totalBackendMs=${totalBackendMs} `
    + `redisLimiterMs=${context.redisLimiterMs ?? 0} `
    + `redisLoginMs=${context.redisLoginMs ?? 0} `
    + `dbUserLookupMs=${context.dbUserLookupMs ?? 0} `
    + `argon2Ms=${context.argon2Ms ?? 0} `
    + `membershipMs=${context.membershipMs ?? 0} `
    + `sessionMs=${context.sessionMs ?? 0} `
    + `auditLogMs=${context.auditLogMs ?? 0} `
    + `redisCleanupMs=${context.redisCleanupMs ?? 0} `
    + `responseGenerationMs=${context.responseGenerationMs ?? 0}`,
  );
}
