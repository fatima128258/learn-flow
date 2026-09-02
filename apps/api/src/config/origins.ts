const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://web:3000',
  'http://frontend:3000',
  // Production URLs - CRITICAL for cross-origin cookie handling
  'https://learn-flow-web-indol.vercel.app',
  'https://www.learn-flow-web-indol.vercel.app',
];

export function getAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
}

export function isAllowedOrigin(origin: string) {
  const normalized = origin.replace(/\/+$/, '');
  return getAllowedOrigins().some((allowed) => allowed.replace(/\/+$/, '') === normalized);
}