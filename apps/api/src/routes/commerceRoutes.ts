import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import { createCheckout, payOrder } from '../controllers/commerceController';
import { addCartItem, getCart } from '../controllers/cartController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const commerceRouter = Router();

commerceRouter.get(
  '/:organizationId/student/cart',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  getCart,
);

commerceRouter.post(
  '/:organizationId/student/cart/:courseId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  addCartItem,
);

commerceRouter.post(
  '/:organizationId/student/courses/:courseId/checkout',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  createCheckout,
);

commerceRouter.post(
  '/:organizationId/student/orders/:orderId/pay',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  payOrder,
);

export default commerceRouter;
