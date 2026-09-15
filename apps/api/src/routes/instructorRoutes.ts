import { Router } from 'express';
import { requireAuth, requireOrganizationContext, requireRole, requireVerifiedEmail } from '../middleware/auth';
import { instructorDashboard } from '../controllers/courseController';
import { listStudentProgress } from '../controllers/orgAdminController';

const instructorRouter = Router();

instructorRouter.get(
  '/:organizationId/dashboard',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  instructorDashboard,
);

instructorRouter.get(
  '/student-progress',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  listStudentProgress,
);

export default instructorRouter;
