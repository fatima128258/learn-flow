import { Router } from 'express';
import { requireAuth, requirePlatformAdmin, requireOrgAdmin } from '../middleware/auth';
import {
  listPlatformAuditLogs,
  listOrgAuditLogs,
} from '../controllers/auditLogController';

export const platformAuditLogRouter = Router();
platformAuditLogRouter.use(requireAuth, requirePlatformAdmin);
platformAuditLogRouter.get('/', listPlatformAuditLogs);

export const orgAuditLogRouter = Router();
orgAuditLogRouter.use(requireAuth, requireOrgAdmin);
orgAuditLogRouter.get('/', listOrgAuditLogs);