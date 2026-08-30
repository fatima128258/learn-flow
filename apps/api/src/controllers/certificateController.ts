import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/certificateService';

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
    case 'CERTIFICATE_NOT_FOUND':
      return fail(res, 404, 'CERTIFICATE_NOT_FOUND');
    case 'CERTIFICATE_PDF_NOT_FOUND':
      return fail(res, 404, 'CERTIFICATE_PDF_NOT_FOUND');
    case 'FORBIDDEN':
      return fail(res, 403, 'FORBIDDEN');
    case 'STUDENT_NOT_ENROLLED':
      return fail(res, 403, 'STUDENT_NOT_ENROLLED');
    case 'COURSE_NOT_COMPLETED':
      return fail(res, 409, 'COURSE_NOT_COMPLETED');
    case 'CERTIFICATE_EXISTS':
      return fail(res, 409, 'CERTIFICATE_EXISTS');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function generateCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.generateCertificate(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listCertificates(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listCertificates(tenantOrganizationId(req), req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getCertificate(
      tenantOrganizationId(req),
      req.user.id,
      req.params.certificateId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function verifyCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await service.verifyCertificate(req.params.verificationToken);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function downloadCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const url = await service.getCertificateDownloadUrl(
      tenantOrganizationId(req),
      req.user.id,
      req.user.role,
      req.params.certificateId,
    );
    return res.redirect(url);
  } catch (err) {
    return handleError(res, err);
  }
}
