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

export default courseRouter;
