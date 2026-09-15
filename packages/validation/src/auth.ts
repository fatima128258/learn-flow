// Basic validation utilities for authentication-related input.
// Kept intentionally dependency-free. These return boolean and can be
// composed into more complex validators later.

export function isValidEmail(email: string) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim();
  const re = /^[A-Za-z0-9]+(?:[._+-][A-Za-z0-9]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
  return re.test(normalized);
}

export function isValidPassword(password: string) {
  if (typeof password !== 'string') return false;
  // Minimum 8 characters. Do not enforce complexity here — leave for policy.
  return password.length >= 8;
}
