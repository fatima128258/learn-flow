import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/ownerPaymentDetailService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('INVALID_')) return fail(res, 400, message);
  return fail(res, 500, 'SERVER_ERROR');
}

export async function getPaymentDetails(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || !req.organizationId) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.getPaymentDetails(req.organizationId, req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function savePaymentDetails(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || !req.organizationId) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.savePaymentDetails(req.organizationId, req.user.id, req.body || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}
