import { Router, NextFunction, Response } from 'express';
import {
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  generateCertificate,
  listCertificates,
  getCertificate,
  verifyCertificate,
} from '../controllers/certificateController';

function requireStudentOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
  }
  next();
}

const studentMiddleware = [
  requireAuth,
  requireVerifiedEmail,
  requireOrganizationContext,
  requireStudentOnly,
];

const certificateRouter = Router();

certificateRouter.post(
  '/:organizationId/student/courses/:courseId/certificate',
  ...studentMiddleware,
  generateCertificate,
);

certificateRouter.get(
  '/:organizationId/student/certificates',
  ...studentMiddleware,
  listCertificates,
);

certificateRouter.get(
  '/:organizationId/student/certificates/:certificateId',
  ...studentMiddleware,
  getCertificate,
);

export const publicCertificateRouter = Router();

publicCertificateRouter.get('/verify/:verificationToken', verifyCertificate);

export default certificateRouter;
