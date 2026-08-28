import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  getCourseProgress,
  recordLessonProgress,
} from '../controllers/progressController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const progressRouter = Router();

const studentMiddleware = [
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
];

progressRouter.get(
  '/:organizationId/student/courses/:courseId/progress',
  ...studentMiddleware,
  getCourseProgress,
);

progressRouter.post(
  '/:organizationId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId/progress',
  ...studentMiddleware,
  recordLessonProgress,
);

export default progressRouter;
