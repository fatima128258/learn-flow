import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/organizationService';

// Temporary inline validation function
function isOrganizationStatus(status: unknown) {
  return typeof status === 'string' && ['active', 'inactive', 'suspended'].includes(status);
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : undefined;
  switch (message) {
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'INVALID_SLUG':
      return fail(res, 400, 'INVALID_SLUG');
    case 'INVALID_EMAIL':
      return fail(res, 400, 'INVALID_EMAIL');
    case 'INVALID_STATUS':
      return fail(res, 400, 'INVALID_STATUS');
    case 'PASSWORD_TOO_SHORT':
      return fail(res, 400, 'PASSWORD_TOO_SHORT');
    case 'ROLE_NOT_ALLOWED':
      return fail(res, 403, 'ROLE_NOT_ALLOWED');
    case 'ORGANIZATION_SLUG_TAKEN':
      return fail(res, 409, 'ORGANIZATION_SLUG_TAKEN');
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

export async function dashboard(_req: Request, res: Response) {
  try {
    const data = await service.getDashboardSummary();
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, slug } = req.body || {};
    const data = await service.createOrganization({
      name,
      slug,
      actor: req.user
        ? { userId: req.user.id, email: req.user.email, role: req.user.role }
        : null,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function list(req: Request, res: Response) {
  try {
    const page = parsePage(req.query.page);
    const limit = parsePage(req.query.limit);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    if (status && !isOrganizationStatus(status)) {
      return fail(res, 400, 'INVALID_STATUS');
    }
    const result = await service.listOrganizations({ page, limit, status, q });
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await service.getOrganization(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listMembers(req: Request, res: Response) {
  try {
    const page = parsePage(req.query.page);
    const limit = parsePage(req.query.limit);
    const result = await service.listOrganizationMembers(req.params.id, { page, limit });
    return res.json({
      success: true,
      data: { organization: result.organization, members: result.members },
      meta: result.meta,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { name, slug } = req.body || {};
    const data = await service.updateOrganization(req.params.id, { name, slug });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    const { status } = req.body || {};
    const data = await service.setOrganizationStatus(req.params.id, status);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function assignAdmin(req: Request, res: Response) {
  try {
    const { email, userId, name, password, role } = req.body || {};
    const data = await service.assignOrganizationAdmin(req.params.id, {
      email,
      userId,
      name,
      password,
      role,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
