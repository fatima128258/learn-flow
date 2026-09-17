const EMAIL_PATTERN = /^[A-Za-z0-9]+(?:[._+-][A-Za-z0-9]+)*@[A-Za-z0-9]{2,}(?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9]{2,}(?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function isValidEmail(email: unknown): boolean {
  return normalizeEmail(email) !== null;
}

export function isValidPassword(password: string) {
  if (typeof password !== 'string') return false;
  // Minimum 8 characters. Do not enforce complexity here — leave for policy.
  return password.length >= 8;
}
