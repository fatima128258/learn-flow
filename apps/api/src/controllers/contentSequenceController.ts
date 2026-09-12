import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/contentSequenceService';

function handle(res: Response, err: unknown) {
  const code = err instanceof Error ? err.message : 'SERVER_ERROR';
  const status = code === 'FORBIDDEN' ? 403 : code.endsWith('_NOT_FOUND') ? 404 : code === 'ORGANIZATION_REQUIRED' || code === 'INVALID_CONTENT_ORDER' ? 400 : 500;
  return res.status(status).json({ success: false, error: code });
}
export async function list(req: AuthenticatedRequest, res: Response) {
  try { if (!req.organizationId) throw new Error('ORGANIZATION_REQUIRED'); return res.json({ success: true, data: await service.list(req.organizationId, req.params.courseId, req.params.moduleId) }); } catch (e) { return handle(res, e); }
}
export async function replace(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.organizationId || !req.user) throw new Error('ORGANIZATION_REQUIRED');
    const data = await service.replaceOrder(req.organizationId, req.params.courseId, req.params.moduleId, req.body?.items, { userId: req.user.id, role: req.user.role });
    return res.json({ success: true, data });
  } catch (e) { return handle(res, e); }
}
