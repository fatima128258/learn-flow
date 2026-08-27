import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import {
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../controllers/lessonController';

const lessonRouter = Router();

lessonRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/lessons',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listLessons,
);

lessonRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/lessons/:lessonId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  getLesson,
);

lessonRouter.post(
  '/:organizationId/courses/:courseId/modules/:moduleId/lessons',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createLesson,
);

lessonRouter.patch(
  '/:organizationId/courses/:courseId/modules/:moduleId/lessons/:lessonId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateLesson,
);

lessonRouter.delete(
  '/:organizationId/courses/:courseId/modules/:moduleId/lessons/:lessonId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  deleteLesson,
);

export default lessonRouter;