import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface E2EFixtures {
  organizationId: string;
  categoryId: string;
  courseId: string;
  draftCourseId: string;
  moduleId: string;
  credentials: {
    password: string;
    platformAdmin: { email: string };
    orgAdmin: { email: string };
    instructor: { email: string };
    student: { email: string };
    buyer: { email: string };
  };
}

export function loadFixtures(): E2EFixtures {
  const file = resolve(__dirname, '../.local/seed.json');
  return JSON.parse(readFileSync(file, 'utf8')) as E2EFixtures;
}