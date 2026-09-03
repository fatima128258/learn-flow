const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please enter your email and password.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
  SERVER_ERROR: 'Something went wrong while signing you in. Please try again.',
};

const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please fill in all required fields.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_MISMATCH: 'Passwords do not match.',
  ROLE_NOT_ALLOWED: 'You cannot register with that role.',
  EMAIL_TAKEN: 'That email address is already registered. Try signing in instead.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
  SERVER_ERROR: 'Something went wrong while creating your account. Please try again.',
};

const FORGOT_PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  MISSING_EMAIL: 'Please enter your email address.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
  SERVER_ERROR: 'Something went wrong while sending the reset link. Please try again.',
};

const RESET_PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please fill in all password fields.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_MISMATCH: 'Passwords do not match.',
  INVALID_TOKEN: 'Invalid reset link.',
  TOKEN_ALREADY_USED: 'This reset link has already been used.',
  TOKEN_EXPIRED: 'This reset link has expired. Please request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
  SERVER_ERROR: 'Something went wrong while resetting your password. Please try again.',
};

const VERIFY_EMAIL_ERROR_MESSAGES: Record<string, string> = {
  MISSING_TOKEN: 'Invalid verification link.',
  INVALID_TOKEN: 'Invalid verification link.',
  TOKEN_ALREADY_USED: 'This email has already been verified.',
  TOKEN_EXPIRED: 'This verification link has expired. Please request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
  SERVER_ERROR: 'Something went wrong while verifying your email. Please try again.',
};

function getErrorMessage(messages: Record<string, string>, code?: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof code === 'string' && code in messages) {
    return messages[code];
  }
  return fallback;
}

export function getLoginErrorMessage(code?: unknown): string {
  return getErrorMessage(LOGIN_ERROR_MESSAGES, code, 'Invalid email or password.');
}

export function getRegisterErrorMessage(code?: unknown): string {
  return getErrorMessage(REGISTER_ERROR_MESSAGES, code, 'Failed to create account. Please try again.');
}

export function getForgotPasswordErrorMessage(code?: unknown): string {
  return getErrorMessage(FORGOT_PASSWORD_ERROR_MESSAGES, code, 'Failed to send reset email. Please try again.');
}

export function getResetPasswordErrorMessage(code?: unknown): string {
  return getErrorMessage(RESET_PASSWORD_ERROR_MESSAGES, code, 'Failed to reset password. Please try again.');
}

export function getVerifyEmailErrorMessage(code?: unknown): string {
  return getErrorMessage(VERIFY_EMAIL_ERROR_MESSAGES, code, 'Failed to verify your email. Please try again.');
}
