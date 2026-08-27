import { Router } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole,
} from '../middleware/auth';
import {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
} from '../controllers/quizController';
import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listOptions,
  createOption,
  updateOption,
  deleteOption,
} from '../controllers/questionController';

const quizRouter = Router();

quizRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listQuizzes,
);

quizRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  getQuiz,
);

quizRouter.post(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createQuiz,
);

quizRouter.patch(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateQuiz,
);

quizRouter.delete(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  deleteQuiz,
);

quizRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listQuestions,
);

quizRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  getQuestion,
);

quizRouter.post(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createQuestion,
);

quizRouter.patch(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateQuestion,
);

quizRouter.delete(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  deleteQuestion,
);

quizRouter.get(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId/options',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  listOptions,
);

quizRouter.post(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId/options',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  createOption,
);

quizRouter.patch(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId/options/:optionId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  updateOption,
);

quizRouter.delete(
  '/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions/:questionId/options/:optionId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  deleteOption,
);

export default quizRouter;
