import { Router } from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
import { getDatabaseLatencyDiagnostics } from '../controllers/databaseDiagnosticsController';

const diagnosticsRouter = Router();

diagnosticsRouter.use(requireAuth, requirePlatformAdmin);
diagnosticsRouter.get('/db-latency', getDatabaseLatencyDiagnostics);

export default diagnosticsRouter;
