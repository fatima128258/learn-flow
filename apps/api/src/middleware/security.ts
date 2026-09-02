import { Request, Response, NextFunction } from 'express';

const COOKIE_SECURE =
  process.env.NODE_ENV === 'production' ||
  String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Production: always enable HSTS when cookie security is enabled
  if (COOKIE_SECURE) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Log cookie mode for debugging
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_COOKIES) {
    console.log(`[Security] Cookie mode: ${COOKIE_SECURE ? 'Secure (cross-origin)' : 'Insecure (localhost only)'}`);
  }
  next();
}