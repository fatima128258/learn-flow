import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import { uploadSingle } from '../middleware/multipart';
import { uploadMedia, getMediaUrl, deleteMedia } from '../controllers/mediaController';

const staffMiddleware = [
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
];

const mediaRouter = Router();

mediaRouter.post('/:organizationId/media', ...staffMiddleware, uploadSingle('file'), uploadMedia);

mediaRouter.get(
  '/:organizationId/media/:mediaId/url',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  getMediaUrl,
);

mediaRouter.delete('/:organizationId/media/:mediaId', ...staffMiddleware, deleteMedia);

export default mediaRouter;