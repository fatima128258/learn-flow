import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';

export const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);

// Start helper
export const start = (port: number | string = process.env.PORT ?? 4000) => {
  const p = typeof port === 'string' ? Number(port) : port;
  return app.listen(p, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${p}`);
  });
};

// If run directly, start the server
if (typeof require !== 'undefined' && require.main === module) {
  start();
}

export default app;
