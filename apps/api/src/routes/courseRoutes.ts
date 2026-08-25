import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import { createCourse } from '../controllers/courseController';

const courseRouter = Router();

courseRouter.post(
  '/:organizationId/courses',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createCourse,
);

export default courseRouter;
