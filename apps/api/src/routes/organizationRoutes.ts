import { Router } from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
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

const adminRouter = Router();
adminRouter.use(requireAuth, requirePlatformAdmin);
adminRouter.get('/dashboard', dashboard);

const organizationRouter = Router();
organizationRouter.use(requireAuth, requirePlatformAdmin);
organizationRouter.get('/', list);
organizationRouter.post('/', create);
organizationRouter.get('/:id', getById);
organizationRouter.get('/:id/members', listMembers);
organizationRouter.patch('/:id', update);
organizationRouter.patch('/:id/status', updateStatus);
organizationRouter.post('/:id/admins', assignAdmin);

export { adminRouter, organizationRouter };
