import { Router } from 'express';
import { requireAuth, requireOrgAdmin } from '../middleware/auth';
import {
  dashboard,
  analytics,
  listEnrollments,
  getOrganization,
  listUsers,
  getUser,
  createInstructor,
  createStudent,
  updateUser,
  suspendUser,
  unsuspendUser,
} from '../controllers/orgAdminController';

const orgAdminRouter = Router();
orgAdminRouter.use(requireAuth, requireOrgAdmin);
orgAdminRouter.get('/dashboard', dashboard);
orgAdminRouter.get('/analytics', analytics);
orgAdminRouter.get('/enrollments', listEnrollments);
orgAdminRouter.get('/organization', getOrganization);
orgAdminRouter.get('/users', listUsers);
orgAdminRouter.post('/instructors', createInstructor);
orgAdminRouter.post('/students', createStudent);
orgAdminRouter.get('/users/:userId', getUser);
orgAdminRouter.patch('/users/:userId', updateUser);
orgAdminRouter.patch('/users/:userId/suspend', suspendUser);
orgAdminRouter.patch('/users/:userId/unsuspend', unsuspendUser);

export default orgAdminRouter;
