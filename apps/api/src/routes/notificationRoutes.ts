import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  listNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notificationController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const notificationRouter = Router();

const studentMiddleware = [
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
];

notificationRouter.get(
  '/:organizationId/student/notifications',
  ...studentMiddleware,
  listNotifications,
);

notificationRouter.get(
  '/:organizationId/student/notifications/unread-count',
  ...studentMiddleware,
  getUnreadCount,
);

notificationRouter.post(
  '/:organizationId/student/notifications/read-all',
  ...studentMiddleware,
  markAllNotificationsAsRead,
);

notificationRouter.post(
  '/:organizationId/student/notifications/:notificationId/read',
  ...studentMiddleware,
  markNotificationAsRead,
);

export default notificationRouter;
