import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/commerceService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function tenantOrganizationId(req: AuthenticatedRequest) {
  if (!req.organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return req.organizationId;
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : undefined;
  switch (message) {
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'COURSE_NOT_PUBLISHED':
      return fail(res, 400, 'COURSE_NOT_PUBLISHED');
    case 'ALREADY_ENROLLED':
      return fail(res, 409, 'ALREADY_ENROLLED');
    case 'ALREADY_PURCHASED':
      return fail(res, 409, 'ALREADY_PURCHASED');
    case 'CHECKOUT_ALREADY_EXISTS':
      return fail(res, 409, 'CHECKOUT_ALREADY_EXISTS');
    case 'ORDER_NOT_FOUND':
      return fail(res, 404, 'ORDER_NOT_FOUND');
    case 'ORDER_NOT_PENDING':
      return fail(res, 409, 'ORDER_NOT_PENDING');
    case 'PAYMENT_NOT_FOUND':
      return fail(res, 404, 'PAYMENT_NOT_FOUND');
    case 'PAYMENT_NOT_PENDING':
      return fail(res, 409, 'PAYMENT_NOT_PENDING');
    case 'PAYMENT_INFO_REQUIRED':
      return fail(res, 400, 'PAYMENT_INFO_REQUIRED');
    case 'INVALID_TRANSACTION_ID':
      return fail(res, 400, 'INVALID_TRANSACTION_ID');
    case 'MANUAL_PAYMENT_PENDING_REVIEW':
      return fail(res, 202, 'MANUAL_PAYMENT_PENDING_REVIEW');
    case 'PAYMENT_FAILED':
      return fail(res, 402, 'PAYMENT_FAILED');
    case 'LEGACY_PURCHASE_DISABLED':
      return fail(res, 410, 'LEGACY_PURCHASE_DISABLED');
    case 'PURCHASE_DATABASE_TIMEOUT':
      return fail(res, 503, 'PURCHASE_DATABASE_TIMEOUT');
    case 'FORBIDDEN':
      return fail(res, 403, 'FORBIDDEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function createCheckout(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const paymentMethod = req.body?.paymentMethod as 'COD' | 'BANK_TRANSFER' | 'MOCK' | undefined;
    const data = await service.createCheckoutOrder(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      paymentMethod,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function submitManualPayment(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const paymentMethod = req.body?.paymentMethod as 'COD' | 'BANK_TRANSFER';
    const data = await service.submitManualPayment(
      tenantOrganizationId(req),
      req.user.id,
      req.params.orderId,
      paymentMethod,
      req.body?.transactionId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listPendingManualPayments(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.listPendingManualPayments(tenantOrganizationId(req), req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listStudentPayments(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.listPaymentsForStudent(tenantOrganizationId(req), req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function approveManualPayment(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.approveManualPayment(
      tenantOrganizationId(req),
      req.user.id,
      req.params.paymentId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function rejectManualPayment(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.rejectManualPayment(
      tenantOrganizationId(req),
      req.user.id,
      req.params.paymentId,
      req.body?.reason,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function purchaseCourse(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    await service.purchaseCourse(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function payOrder(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return fail(res, 401, 'NOT_AUTHENTICATED');
    const data = await service.payOrder(
      tenantOrganizationId(req),
      req.user.id,
      req.params.orderId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
