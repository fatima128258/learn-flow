import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import { adminRouter, organizationRouter } from './routes/organizationRoutes';
import orgAdminRouter from './routes/orgAdminRoutes';
import categoryRouter from './routes/categoryRoutes';
import courseRouter from './routes/courseRoutes';
import moduleRouter from './routes/moduleRoutes';
import lessonRouter from './routes/lessonRoutes';
import quizRouter from './routes/quizRoutes';
import enrollmentRouter from './routes/enrollmentRoutes';
import studentLearningRouter from './routes/studentLearningRoutes';
import progressRouter from './routes/progressRoutes';
import commerceRouter from './routes/commerceRoutes';
import certificateRouter, { publicCertificateRouter } from './routes/certificateRoutes';
import searchRouter from './routes/searchRoutes';
import notificationRouter from './routes/notificationRoutes';
import mediaRouter from './routes/mediaRoutes';
import { platformAuditLogRouter, orgAuditLogRouter } from './routes/auditLogRoutes';
import { startNotificationWorker } from './queues/notificationWorker';
import { apiRateLimiter } from './middleware/rateLimit';
import { securityHeaders } from './middleware/security';
import { csrfOriginCheck } from './middleware/csrf';
import { isAllowedOrigin, getAllowedOrigins } from './config/origins';
import { collectHealthReport } from './services/healthService';

export const app = express();

app.use(securityHeaders);

// CSRF defense-in-depth: reject state-changing requests whose Origin is not allowlisted.
app.use('/api/v1', csrfOriginCheck);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// General API rate limiting (per IP + method + path) - exempt health/readiness
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/ready') {
    return next();
  }
  if (req.path.startsWith('/api/v1')) {
    return apiRateLimiter(req, res, next);
  }
  return next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'learnflow-api',
    version: '1.0.0'
  });
});

// Liveness endpoint: always 200 while the app is running, with per-dependency statuses.
app.get('/api/health', async (req, res) => {
  try {
    const report = await collectHealthReport();
    res.status(200).json(report);
  } catch {
    res.status(200).json({
      status: 'degraded',
      service: 'learnflow-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        database: { status: 'down', error: 'UNAVAILABLE' },
        redis: { status: 'down', error: 'UNAVAILABLE' },
        objectStorage: { status: 'down', error: 'UNAVAILABLE' },
      },
    });
  }
});

// Readiness endpoint: 503 while any required dependency is unavailable.
app.get('/api/ready', async (req, res) => {
  try {
    const report = await collectHealthReport();
    res.status(report.status === 'ready' ? 200 : 503).json(report);
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'learnflow-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        database: { status: 'down', error: 'UNAVAILABLE' },
        redis: { status: 'down', error: 'UNAVAILABLE' },
        objectStorage: { status: 'down', error: 'UNAVAILABLE' },
      },
    });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/organizations', courseRouter);
app.use('/api/v1/organizations', moduleRouter);
app.use('/api/v1/organizations', lessonRouter);
app.use('/api/v1/organizations', quizRouter);
app.use('/api/v1/organizations', enrollmentRouter);
app.use('/api/v1/organizations', studentLearningRouter);
app.use('/api/v1/organizations', progressRouter);
app.use('/api/v1/organizations', commerceRouter);
app.use('/api/v1/organizations', certificateRouter);
app.use('/api/v1/organizations', searchRouter);
app.use('/api/v1/organizations', notificationRouter);
app.use('/api/v1/organizations', mediaRouter);
app.use('/api/v1/certificates', publicCertificateRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/org', orgAdminRouter);
app.use('/api/v1/org/categories', categoryRouter);
app.use('/api/v1/admin/audit-logs', platformAuditLogRouter);
app.use('/api/v1/org/audit-logs', orgAuditLogRouter);

// JSON 404 responses for unknown API routes
app.use('/api/v1', (req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND' });
});

// JSON error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const e = err as { type?: string; status?: number };
  if (res.headersSent) {
    return next(err as Error);
  }
  if (e.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'INVALID_JSON' });
  }
  if (e.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'PAYLOAD_TOO_LARGE' });
  }
  return res.status(e.status ?? 500).json({ success: false, error: 'SERVER_ERROR' });
});

export const start = (port: number | string = process.env.PORT ?? 4000) => {
  const p = typeof port === 'string' ? Number(port) : port;
  startNotificationWorker();
  return app.listen(p, () => {
    console.log(`API server listening on http://localhost:${p}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    const cookieSecure = process.env.NODE_ENV === 'production' || String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true';
    console.log(`Session cookie mode: ${cookieSecure ? 'Secure (SameSite=None)' : 'Insecure (SameSite=Lax, localhost only)'}`);
    console.log(`CORS allowed origins: ${getAllowedOrigins().join(', ')}`);
  });
};

if (typeof require !== 'undefined' && require.main === module) {
  start();
}

export default app;
