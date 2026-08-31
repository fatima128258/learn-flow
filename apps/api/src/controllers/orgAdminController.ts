import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/orgAdminService';

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
      return fail(res, 400, 'MISSING_FIELDS');
    case 'INVALID_EMAIL':
      return fail(res, 400, 'INVALID_EMAIL');
    case 'INVALID_ROLE':
      return fail(res, 400, 'INVALID_ROLE');
    case 'PASSWORD_TOO_SHORT':
      return fail(res, 400, 'PASSWORD_TOO_SHORT');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'ROLE_NOT_ALLOWED':
      return fail(res, 403, 'ROLE_NOT_ALLOWED');
    case 'ORGANIZATION_ACCESS_DENIED':
      return fail(res, 403, 'ORGANIZATION_ACCESS_DENIED');
    case 'USER_ALREADY_IN_ORGANIZATION':
      return fail(res, 409, 'USER_ALREADY_IN_ORGANIZATION');
    case 'ORGANIZATION_NOT_FOUND':
      return fail(res, 404, 'ORGANIZATION_NOT_FOUND');
    case 'USER_NOT_FOUND':
      return fail(res, 404, 'USER_NOT_FOUND');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

function parsePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function dashboard(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.getDashboard(tenantOrganizationId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function analytics(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.getAnalytics(tenantOrganizationId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getOrganization(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.getOrganization(tenantOrganizationId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const page = parsePage(req.query.page);
    const limit = parsePage(req.query.limit);
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const result = await service.listUsers(tenantOrganizationId(req), { page, limit, role });
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getUser(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.getUser(tenantOrganizationId(req), req.params.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createInstructor(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, email, password, role } = req.body || {};
    const data = await service.createManagedUser(tenantOrganizationId(req), {
      name,
      email,
      password,
      role,
      requestedRole: 'INSTRUCTOR',
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, email, password, role } = req.body || {};
    const data = await service.createManagedUser(tenantOrganizationId(req), {
      name,
      email,
      password,
      role,
      requestedRole: 'STUDENT',
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, role } = req.body || {};
    const data = await service.updateManagedUser(tenantOrganizationId(req), req.params.userId, {
      name,
      role,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
