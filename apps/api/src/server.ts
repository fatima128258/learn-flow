import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import { adminRouter, organizationRouter } from './routes/organizationRoutes';
import orgAdminRouter from './routes/orgAdminRoutes';
import courseRouter from './routes/courseRoutes';
import moduleRouter from './routes/moduleRoutes';
import lessonRouter from './routes/lessonRoutes';
import quizRouter from './routes/quizRoutes';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://web:3000',
  'http://frontend:3000',
];

function getAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
}

const allowedOrigins = getAllowedOrigins();

export const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.some((allowed) => allowed.replace(/\/$/, '') === normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));
app.use(cookieParser());
app.use(express.json());

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
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/org', orgAdminRouter);

export const start = (port: number | string = process.env.PORT ?? 4000) => {
  const p = typeof port === 'string' ? Number(port) : port;
  return app.listen(p, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${p}`);
  });
};

if (typeof require !== 'undefined' && require.main === module) {
  start();
}

export default app;
