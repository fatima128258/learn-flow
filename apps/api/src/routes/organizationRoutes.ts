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
organizationRouter.use(requireAuth, requirePlatformAdmin);
organizationRouter.get('/', list);
organizationRouter.post('/', create);
organizationRouter.get('/:id', getById);
organizationRouter.get('/:id/members', listMembers);
organizationRouter.patch('/:id', update);
organizationRouter.patch('/:id/status', updateStatus);
organizationRouter.post('/:id/admins', assignAdmin);

export { adminRouter, organizationRouter };
