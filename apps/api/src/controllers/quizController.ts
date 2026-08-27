import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/quizService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function tenantOrganizationId(req: AuthenticatedRequest) {
  if (!req.organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return req.organizationId;
}

function handleError(res: Response, err: any) {
  switch (err?.message) {
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'INVALID_ORDER':
      return fail(res, 400, 'INVALID_ORDER');
    case 'INVALID_VALUE':
      return fail(res, 400, 'INVALID_VALUE');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'MODULE_NOT_FOUND':
      return fail(res, 404, 'MODULE_NOT_FOUND');
    case 'QUIZ_NOT_FOUND':
      return fail(res, 404, 'QUIZ_NOT_FOUND');
    case 'QUIZ_ORDER_TAKEN':
      return fail(res, 409, 'QUIZ_ORDER_TAKEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listQuizzes(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listQuizzes(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function getQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getQuiz(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function createQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.createQuiz(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.body,
    );
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function updateQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateQuiz(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function deleteQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.deleteQuiz(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}
