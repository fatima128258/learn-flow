import { Router } from 'express';
import { requireAuth, requireOrgAdmin } from '../middleware/auth';
import {
  dashboard,
  analytics,
  getOrganization,
  listUsers,
  getUser,
  createInstructor,
  createStudent,
  updateUser,
} from '../controllers/orgAdminController';

const orgAdminRouter = Router();
orgAdminRouter.use(requireAuth, requireOrgAdmin);
orgAdminRouter.get('/dashboard', dashboard);
orgAdminRouter.get('/analytics', analytics);
orgAdminRouter.get('/organization', getOrganization);
orgAdminRouter.get('/users', listUsers);
orgAdminRouter.post('/instructors', createInstructor);
orgAdminRouter.post('/students', createStudent);
orgAdminRouter.get('/users/:userId', getUser);
orgAdminRouter.patch('/users/:userId', updateUser);

export default orgAdminRouter;
