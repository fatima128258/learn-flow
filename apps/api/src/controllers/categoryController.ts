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

function handleError(res: Response, err: any) {
  switch (err?.message) {
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'CATEGORY_NOT_FOUND':
      return fail(res, 404, 'CATEGORY_NOT_FOUND');
    case 'CATEGORY_NAME_TAKEN':
      return fail(res, 409, 'CATEGORY_NAME_TAKEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.listCategories(tenantOrganizationId(req));
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.createCategory(tenantOrganizationId(req), req.body);
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
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
  } catch (err: any) {
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
  } catch (err: any) {
    return handleError(res, err);
  }
}