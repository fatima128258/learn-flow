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
import { isAllowedOrigin } from './config/origins';

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

// General API rate limiting (per IP + method + path)
app.use('/api/v1', apiRateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'learnflow-api',
    version: '1.0.0'
  });
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
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'PAYLOAD_TOO_LARGE' });
  }
  return res.status(err?.status ?? 500).json({ success: false, error: 'SERVER_ERROR' });
});

export const start = (port: number | string = process.env.PORT ?? 4000) => {
  const p = typeof port === 'string' ? Number(port) : port;
  startNotificationWorker();
  return app.listen(p, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${p}`);
  });
};

if (typeof require !== 'undefined' && require.main === module) {
  start();
}

export default app;
