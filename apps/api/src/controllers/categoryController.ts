import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/categoryService';

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
    case 'MISSING_FIELDS':
    case 'INVALID_INPUT':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'CATEGORY_NOT_FOUND':
      return fail(res, 404, 'CATEGORY_NOT_FOUND');
    case 'CATEGORY_NAME_TAKEN':
      return fail(res, 409, 'CATEGORY_NAME_TAKEN');
    case 'CATEGORY_IN_USE':
      return fail(res, 409, 'CATEGORY_IN_USE');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const data = await service.listCategories(tenantOrganizationId(req), { page, limit, search });
    return res.status(200).json({ success: true, data: data.items, meta: {
      page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages,
    } });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.getCategory(tenantOrganizationId(req), req.params.categoryId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }

}

export async function listAssignableCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.listAssignableCategories(tenantOrganizationId(req), req.user ? { id: req.user.id, role: req.user.role } : undefined);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.createCategory(tenantOrganizationId(req), req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.updateCategory(
      tenantOrganizationId(req),
      req.params.categoryId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await service.deleteCategory(
      tenantOrganizationId(req),
      req.params.categoryId,
    );
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createPrivateCategory(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'INSTRUCTOR') return fail(res, 403, 'ROLE_NOT_ALLOWED');
    const data = await service.createPrivateCategory(tenantOrganizationId(req), req.user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
