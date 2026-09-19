import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  createCheckout,
  purchaseCourse,
  payOrder,
  submitManualPayment,
  listPendingManualPayments,
  listOrganizationPayments,
  approveManualPayment,
  rejectManualPayment,
  listStudentPayments,
} from '../controllers/commerceController';
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

function requireOwnerReviewAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role === 'ORG_ADMIN' || req.user.role === 'PLATFORM_ADMIN' || req.user.role === 'INSTRUCTOR') {
    return next();
  }
  return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
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
  '/:organizationId/student/courses/:courseId/purchase',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  purchaseCourse,
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
  '/:organizationId/student/orders/:orderId/manual-payment',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  submitManualPayment,
);

commerceRouter.get(
  '/:organizationId/student/payments',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
  listStudentPayments,
);

commerceRouter.get(
  '/:organizationId/payments/pending',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireOwnerReviewAccess,
  listPendingManualPayments,
);

commerceRouter.get(
  '/:organizationId/payments',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireOwnerReviewAccess,
  listOrganizationPayments,
);

commerceRouter.post(
  '/:organizationId/payments/:paymentId/approve',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireOwnerReviewAccess,
  approveManualPayment,
);

commerceRouter.post(
  '/:organizationId/payments/:paymentId/reject',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireOwnerReviewAccess,
  rejectManualPayment,
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
