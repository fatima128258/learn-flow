import { Router } from 'express';
import { requireAuth, requireOrganizationContext, requirePlatformAdmin, requireRole, requireVerifiedEmail } from '../middleware/auth';
import {
  dashboard,
  create,
  list,
  getById,
  listMembers,
  update,
  updateStatus,
  assignAdmin,
} from '../controllers/organizationController';
import { getPrivateCategory, updatePrivateCategory } from '../controllers/categoryController';

const adminRouter = Router();
adminRouter.use(requireAuth, requirePlatformAdmin);
adminRouter.get('/dashboard', dashboard);

const organizationRouter = Router();
const requireOrganizationAdmin = [requireAuth, requirePlatformAdmin];
organizationRouter.get(
  '/:organizationId/categories/:categoryId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  getPrivateCategory,
);
organizationRouter.patch(
  '/:organizationId/categories/:categoryId',
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('INSTRUCTOR'),
  updatePrivateCategory,
);
organizationRouter.get('/', ...requireOrganizationAdmin, list);
organizationRouter.post('/', ...requireOrganizationAdmin, create);
organizationRouter.get('/:id', ...requireOrganizationAdmin, getById);
organizationRouter.get('/:id/members', ...requireOrganizationAdmin, listMembers);
organizationRouter.patch('/:id', ...requireOrganizationAdmin, update);
organizationRouter.patch('/:id/status', ...requireOrganizationAdmin, updateStatus);
organizationRouter.post('/:id/admins', ...requireOrganizationAdmin, assignAdmin);

export { adminRouter, organizationRouter };
