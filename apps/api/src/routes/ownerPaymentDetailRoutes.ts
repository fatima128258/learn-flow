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
  getOrganizationPaymentDetails,
  saveOrganizationPaymentDetails,
} from '../controllers/ownerPaymentDetailController';

const ownerPaymentDetailRouter = Router();

ownerPaymentDetailRouter.get(
  '/org/payment-details',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'PLATFORM_ADMIN'),
  getOrganizationPaymentDetails,
);

ownerPaymentDetailRouter.patch(
  '/org/payment-details',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'PLATFORM_ADMIN'),
  saveOrganizationPaymentDetails,
);

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
