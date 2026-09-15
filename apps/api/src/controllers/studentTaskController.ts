import { Response } from 'express';
import getPrisma from '../prisma';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = getPrisma();

type TaskPayload = {
  title?: string;
  description?: string | null;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
};

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function parseNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('INVALID_TASK');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_TASK');
  }

  return parsed;
}

function normalizeStatus(value: unknown): 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' {
  if (value === 'PENDING' || value === 'IN_PROGRESS' || value === 'COMPLETED') {
    return value;
  }
  throw new Error('INVALID_TASK');
}

function normalizePriority(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') {
    return value;
  }
  throw new Error('INVALID_TASK');
}

function serializeTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  priority: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    priority: task.priority,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function getOwnedTask(req: AuthenticatedRequest, taskId: string) {
  if (!req.user) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task || task.studentId !== req.user.id) {
    throw new Error('TASK_NOT_FOUND');
  }

  return task;
}

function buildCompletedAt(status: string | undefined, previousCompletedAt: Date | null) {
  if (status === 'COMPLETED') {
    return new Date();
  }
  if (status === 'IN_PROGRESS' || status === 'PENDING') {
    return null;
  }
  return previousCompletedAt;
}

export async function listStudentTasks(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }

    const tasks = await prisma.task.findMany({
      where: { studentId: req.user.id },
      orderBy: [{ createdAt: 'desc' }],
    });

    return res.status(200).json({
      success: true,
      data: tasks.map(serializeTask),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SERVER_ERROR';
    return fail(res, 500, message === 'NOT_AUTHENTICATED' ? 'NOT_AUTHENTICATED' : 'SERVER_ERROR');
  }
}

export async function createStudentTask(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }

    const body = (req.body ?? {}) as TaskPayload;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return fail(res, 400, 'INVALID_TASK');
    }

    const status = body.status ? normalizeStatus(body.status) : 'PENDING';
    const priority = body.priority ? normalizePriority(body.priority) : 'MEDIUM';
    const dueDate = parseNullableDate(body.dueDate);
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;

    const task = await prisma.task.create({
      data: {
        studentId: req.user.id,
        title,
        description,
        status,
        dueDate,
        priority,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    return res.status(201).json({ success: true, data: serializeTask(task) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SERVER_ERROR';
    if (message === 'INVALID_TASK') {
      return fail(res, 400, 'INVALID_TASK');
    }
    return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function getStudentTask(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }

    try {
      const task = await getOwnedTask(req, req.params.taskId);
      return res.status(200).json({ success: true, data: serializeTask(task) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SERVER_ERROR';
      if (message === 'TASK_NOT_FOUND') {
        return fail(res, 404, 'TASK_NOT_FOUND');
      }
      throw error;
    }
  } catch (error) {
    return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function updateStudentTask(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }

    const task = await getOwnedTask(req, req.params.taskId);

    const body = (req.body ?? {}) as TaskPayload;
    const nextTitle = typeof body.title === 'string' ? body.title.trim() : undefined;
    const nextDescription = body.description === undefined ? undefined : (() => {
      if (body.description === null || body.description === '') {
        return null;
      }
      if (typeof body.description === 'string') {
        return body.description.trim() || null;
      }
      return null;
    })();
    const nextStatus = body.status === undefined ? undefined : normalizeStatus(body.status);
    const nextPriority = body.priority === undefined ? undefined : normalizePriority(body.priority);
    const nextDueDate = body.dueDate === undefined ? undefined : parseNullableDate(body.dueDate);

    if (nextTitle !== undefined && !nextTitle) {
      return fail(res, 400, 'INVALID_TASK');
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        title: nextTitle ?? task.title,
        description: nextDescription ?? task.description,
        status: nextStatus ?? task.status,
        dueDate: nextDueDate ?? task.dueDate,
        priority: nextPriority ?? task.priority,
        completedAt: buildCompletedAt(nextStatus ?? task.status, task.completedAt),
      },
    });

    return res.status(200).json({ success: true, data: serializeTask(updatedTask) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SERVER_ERROR';
    if (message === 'TASK_NOT_FOUND') {
      return fail(res, 404, 'TASK_NOT_FOUND');
    }
    if (message === 'INVALID_TASK') {
      return fail(res, 400, 'INVALID_TASK');
    }
    return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function deleteStudentTask(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }

    const task = await getOwnedTask(req, req.params.taskId);
    await prisma.task.delete({ where: { id: task.id } });

    return res.status(200).json({
      success: true,
      data: {
        id: task.id,
        deleted: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SERVER_ERROR';
    if (message === 'TASK_NOT_FOUND') {
      return fail(res, 404, 'TASK_NOT_FOUND');
    }
    return fail(res, 500, 'SERVER_ERROR');
  }
}
