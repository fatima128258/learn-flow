import { Request, Response, NextFunction } from 'express';
import { isAllowedOrigin } from '../config/origins';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfOriginCheck(req: Request, res: Response, next: NextFunction) {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }
  const origin = req.headers.origin;
  if (!origin || typeof origin !== 'string') {
    return next();
  }
  if (isAllowedOrigin(origin)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'CSRF_ORIGIN_REJECTED' });
}