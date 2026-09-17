import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeEmail } from '../utils/validation';

describe('email validation', () => {
  it.each([
    'fatima',
    'fatima@',
    '@gmail.com',
    'fatima@gmail',
    'fatima@gmail.',
    'fatima.com',
    'fatima@.com',
    'fatima..ramzan@gmail.com',
    '.fatima@gmail.com',
    'fatima.@gmail.com',
    'fatima @gmail.com',
    'fatima@gmail .com',
    'fatima@ gmail.com',
    'fatima@@gmail.com',
    'fatima@g mail.com',
    'fatima@gmail..com',
    '',
    '   ',
  ])('rejects malformed email %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it.each([
    'fatima@gmail.com',
    'fatima.ramzan@gmail.com',
    'fatima123@gmail.com',
    'fatima-ramzan@company.com',
    '  Fatima.Ramzan@Company.COM  ',
  ])('accepts valid email %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it('normalizes surrounding whitespace and casing', () => {
    expect(normalizeEmail('  Fatima@Gmail.COM ')).toBe('fatima@gmail.com');
  });

  it('does not repair internal whitespace', () => {
    expect(normalizeEmail('fatima @gmail.com')).toBeNull();
  });
});
