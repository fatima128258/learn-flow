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
  updateCourseThumbnail,
} from '../controllers/courseController';
import { uploadSingle } from '../middleware/multipart';

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

courseRouter.patch(
  '/:organizationId/courses/:courseId/thumbnail',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  uploadSingle('thumbnail'),
  updateCourseThumbnail,
);

export default courseRouter;
