import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/quizAttemptService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function tenantOrganizationId(req: AuthenticatedRequest) {
  if (!req.organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return req.organizationId;
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : undefined;
  switch (message) {
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'INVALID_ANSWERS':
      return fail(res, 400, 'INVALID_ANSWERS');
    case 'ALL_QUESTIONS_REQUIRED':
      return fail(res, 400, 'ALL_QUESTIONS_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'MODULE_NOT_FOUND':
      return fail(res, 404, 'MODULE_NOT_FOUND');
    case 'QUIZ_NOT_FOUND':
      return fail(res, 404, 'QUIZ_NOT_FOUND');
    case 'QUIZ_HAS_NO_QUESTIONS':
      return fail(res, 400, 'QUIZ_HAS_NO_QUESTIONS');
    case 'STUDENT_NOT_ENROLLED':
      return fail(res, 403, 'STUDENT_NOT_ENROLLED');
    case 'MAX_ATTEMPTS_REACHED':
      return fail(res, 403, 'MAX_ATTEMPTS_REACHED');
    case 'ATTEMPT_ALREADY_SUBMITTED':
      return fail(res, 409, 'ATTEMPT_ALREADY_SUBMITTED');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function getQuizForTaking(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getQuizForTaking(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function submitQuizAttempt(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.submitQuizAttempt(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.body,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
