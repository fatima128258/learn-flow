import { randomUUID } from 'node:crypto';

export type User = {
  id: string;
  name: string;
  email: string;
  isActive?: boolean;
};

export function createUser(input: { id?: string; name: string; email: string; isActive?: boolean }): User {
  return {
    id: input.id ?? randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    isActive: input.isActive ?? true,
  };
}

export function greetUser(user: Pick<User, 'name'>): string {
  return `Hello, ${user.name}!`;
}

export function formatUserSummary(user: User): string {
  return `${user.name} <${user.email}>${user.isActive === false ? ' (inactive)' : ''}`;
}

export const sampleUser: User = createUser({
  id: 'user-101',
  name: 'Learnflow User',
  email: 'user@learnflow.dev',
});

console.log(greetUser(sampleUser));
console.log(formatUserSummary(sampleUser));
