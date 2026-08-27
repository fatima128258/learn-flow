import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import {
  listModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
} from '../controllers/moduleController';

const moduleRouter = Router();

moduleRouter.get(
  '/:organizationId/courses/:courseId/modules',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listModules,
);

moduleRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  getModule,
);

moduleRouter.post(
  '/:organizationId/courses/:courseId/modules',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createModule,
);

moduleRouter.patch(
  '/:organizationId/courses/:courseId/modules/:moduleId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateModule,
);

moduleRouter.delete(
  '/:organizationId/courses/:courseId/modules/:moduleId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  deleteModule,
);

export default moduleRouter;