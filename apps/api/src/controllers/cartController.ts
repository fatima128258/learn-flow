import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as cartRepo from '../repositories/cartRepository';
import * as courseRepo from '../repositories/courseRepository';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

export async function getCart(req: AuthenticatedRequest, res: Response) {
  if (!req.user || !req.organizationId) return fail(res, 401, 'NOT_AUTHENTICATED');
  const cart = await cartRepo.getOrCreateCart(req.user.id, req.organizationId);
  return res.json({ success: true, data: cart });
}

export async function addCartItem(req: AuthenticatedRequest, res: Response) {
  if (!req.user || !req.organizationId) return fail(res, 401, 'NOT_AUTHENTICATED');
  const course = await courseRepo.getById(req.organizationId, req.params.courseId);
  if (!course || course.status !== 'PUBLISHED') return fail(res, 404, 'COURSE_NOT_FOUND');
  const cart = await cartRepo.addCourseToCart(req.user.id, req.organizationId, course.id);
  return res.status(201).json({ success: true, data: cart });
}
