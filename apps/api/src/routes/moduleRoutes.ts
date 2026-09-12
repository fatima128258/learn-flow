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
import { list as listContent, replace as replaceContent } from '../controllers/contentSequenceController';

const moduleRouter = Router();

moduleRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/content',
  requireAuth, requireVerifiedEmail, requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'), listContent,
);
moduleRouter.put(
  '/:organizationId/courses/:courseId/modules/:moduleId/content',
  requireAuth, requireVerifiedEmail, requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'), replaceContent,
);

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