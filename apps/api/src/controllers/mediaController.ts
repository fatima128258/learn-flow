import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/mediaService';

interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

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
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'MISSING_FILE':
      return fail(res, 400, 'MISSING_FILE');
    case 'MEDIA_TYPE_NOT_ALLOWED':
      return fail(res, 400, 'MEDIA_TYPE_NOT_ALLOWED');
    case 'MEDIA_TOO_LARGE':
      return fail(res, 413, 'MEDIA_TOO_LARGE');
    case 'MEDIA_NOT_FOUND':
      return fail(res, 404, 'MEDIA_NOT_FOUND');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function uploadMedia(req: MulterRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.uploadMedia(
      tenantOrganizationId(req),
      req.user.id,
      req.file,
    );
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function getMediaUrl(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getMediaSignedUrl(
      tenantOrganizationId(req),
      req.params.mediaId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function deleteMedia(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.deleteMedia(tenantOrganizationId(req), req.params.mediaId);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}