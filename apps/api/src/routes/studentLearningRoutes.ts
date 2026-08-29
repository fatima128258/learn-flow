import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  listEnrolledCourses,
  getEnrolledCourseDetail,
  getCourseOverview,
  listCourseModules,
  listModuleLessons,
  getLessonContent,
} from '../controllers/studentLearningController';
import {
  getQuizForTaking,
  submitQuizAttempt,
} from '../controllers/quizAttemptController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const studentLearningRouter = Router();

const studentMiddleware = [
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
];

studentLearningRouter.get(
  '/:organizationId/student/courses',
  ...studentMiddleware,
  listEnrolledCourses,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId/overview',
  ...studentMiddleware,
  getCourseOverview,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId',
  ...studentMiddleware,
  getEnrolledCourseDetail,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId/modules',
  ...studentMiddleware,
  listCourseModules,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId/modules/:moduleId/lessons',
  ...studentMiddleware,
  listModuleLessons,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId',
  ...studentMiddleware,
  getLessonContent,
);

studentLearningRouter.get(
  '/:organizationId/student/courses/:courseId/modules/:moduleId/quizzes/:quizId',
  ...studentMiddleware,
  getQuizForTaking,
);

studentLearningRouter.post(
  '/:organizationId/student/courses/:courseId/modules/:moduleId/quizzes/:quizId/attempts',
  ...studentMiddleware,
  submitQuizAttempt,
);

export default studentLearningRouter;
