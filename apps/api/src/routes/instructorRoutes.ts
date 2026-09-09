import { Router } from 'express';
import { requireAuth, requireOrganizationContext, requireRole, requireVerifiedEmail } from '../middleware/auth';
import { instructorDashboard } from '../controllers/courseController';

const instructorRouter = Router();

instructorRouter.get(
  '/:organizationId/dashboard',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  instructorDashboard,
);

export default instructorRouter;
