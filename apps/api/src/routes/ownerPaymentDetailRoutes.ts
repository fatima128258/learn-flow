import { Router } from 'express';
import {
  requireAuth,
  requireOrganizationContext,
  requireRole,
  requireVerifiedEmail,
} from '../middleware/auth';
import {
  getPaymentDetails,
  savePaymentDetails,
} from '../controllers/ownerPaymentDetailController';

const ownerPaymentDetailRouter = Router();

ownerPaymentDetailRouter.get(
  '/:organizationId/instructor/payment-details',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  getPaymentDetails,
);

ownerPaymentDetailRouter.patch(
  '/:organizationId/instructor/payment-details',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  savePaymentDetails,
);

export default ownerPaymentDetailRouter;
