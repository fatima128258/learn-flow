import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourseStatus,
} from '../controllers/courseController';

const courseRouter = Router();

courseRouter.get(
  '/:organizationId/courses/:courseId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  getCourse,
);

courseRouter.get(
  '/:organizationId/courses',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listCourses,
);

courseRouter.post(
  '/:organizationId/courses',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createCourse,
);

courseRouter.patch(
  '/:organizationId/courses/:courseId/status',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateCourseStatus,
);

export default courseRouter;
