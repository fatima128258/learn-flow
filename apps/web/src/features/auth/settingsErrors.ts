'use client';

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  MISSING_EMAIL: 'Please enter a new email address.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  EMAIL_TAKEN: 'That email address is already in use.',
  USER_NOT_FOUND: 'Your account could not be found. Please sign in again.',
  SERVER_ERROR: 'Could not update your email. Please try again.',
};

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please fill in all password fields.',
  PASSWORD_TOO_SHORT: 'New password must be at least 8 characters.',
  PASSWORD_MISMATCH: 'New password and confirmation do not match.',
  INVALID_CURRENT_PASSWORD: 'Your current password is incorrect.',
  USER_NOT_FOUND: 'Your account could not be found. Please sign in again.',
  SERVER_ERROR: 'Could not update your password. Please try again.',
};

export function getUpdateEmailErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in EMAIL_ERROR_MESSAGES) {
    return EMAIL_ERROR_MESSAGES[code];
  }
  return 'Could not update your email. Please try again.';
}

export function getChangePasswordErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in PASSWORD_ERROR_MESSAGES) {
    return PASSWORD_ERROR_MESSAGES[code];
  }
  return 'Could not update your password. Please try again.';
}