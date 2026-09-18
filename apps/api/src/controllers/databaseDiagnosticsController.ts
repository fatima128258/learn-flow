import { Request, Response } from 'express';
import { collectDatabaseLatencyDiagnostics } from '../services/databaseDiagnosticsService';

export async function getDatabaseLatencyDiagnostics(_req: Request, res: Response) {
  try {
    const diagnostics = await collectDatabaseLatencyDiagnostics();
    return res.status(200).json({ success: true, data: diagnostics });
  } catch {
    console.error('[diagnostics.db-latency] Diagnostic failed');
    return res.status(503).json({ success: false, error: 'DIAGNOSTIC_UNAVAILABLE' });
  }
}
