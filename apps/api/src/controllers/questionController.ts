import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/questionService';

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
    case 'QUESTION_NOT_FOUND':
      return fail(res, 404, 'QUESTION_NOT_FOUND');
    case 'OPTION_NOT_FOUND':
      return fail(res, 404, 'OPTION_NOT_FOUND');
    case 'QUESTION_ORDER_TAKEN':
      return fail(res, 409, 'QUESTION_ORDER_TAKEN');
    case 'OPTION_ORDER_TAKEN':
      return fail(res, 409, 'OPTION_ORDER_TAKEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listQuestions(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listQuestions(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getQuestion(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.createQuestion(
      tenantOrganizationId(req),
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

export async function updateQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateQuestion(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function deleteQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.deleteQuestion(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listOptions(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listOptions(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createOption(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.createOption(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
      req.body,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateOption(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateOption(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
      req.params.optionId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function deleteOption(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.deleteOption(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.quizId,
      req.params.questionId,
      req.params.optionId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
