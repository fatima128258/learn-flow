export interface User {
  id: string;
  name?: string | null;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}
