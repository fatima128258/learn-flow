import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  enroll,
  listEnrollments,
  getEnrollment,
  unenroll,
} from '../controllers/enrollmentController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const enrollmentRouter = Router();

enrollmentRouter.post(
  '/:organizationId/enrollments/:courseId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  enroll,
);

enrollmentRouter.get(
  '/:organizationId/enrollments',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  listEnrollments,
);

enrollmentRouter.get(
  '/:organizationId/enrollments/:courseId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  getEnrollment,
);

enrollmentRouter.delete(
  '/:organizationId/enrollments/:courseId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  unenroll,
);

export default enrollmentRouter;
