import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  createStudentTask,
  deleteStudentTask,
  getStudentTask,
  listStudentTasks,
  updateStudentTask,
} from '../controllers/studentTaskController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ success: false, error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const studentTaskRouter = Router();

studentTaskRouter.get('/tasks', requireAuth, requireVerifiedEmail, requireStudentOnly, listStudentTasks);
studentTaskRouter.post('/tasks', requireAuth, requireVerifiedEmail, requireStudentOnly, createStudentTask);
studentTaskRouter.get('/tasks/:taskId', requireAuth, requireVerifiedEmail, requireStudentOnly, getStudentTask);
studentTaskRouter.patch('/tasks/:taskId', requireAuth, requireVerifiedEmail, requireStudentOnly, updateStudentTask);
studentTaskRouter.delete('/tasks/:taskId', requireAuth, requireVerifiedEmail, requireStudentOnly, deleteStudentTask);

export default studentTaskRouter;
