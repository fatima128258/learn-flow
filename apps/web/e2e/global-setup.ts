import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalSetup() {
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db?schema=public';

  execFileSync('node', ['scripts/seed-e2e.mjs'], {
    cwd: resolve(__dirname, '../../api'),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
}