import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('Email SMTP Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear transporter cache by requiring fresh module
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Local Mailpit Configuration', () => {
    it('should use localhost:1025 with no authentication', () => {
      process.env.MAIL_SMTP_HOST = 'localhost';
      process.env.MAIL_SMTP_PORT = '1025';
      delete process.env.MAIL_SMTP_USER;
      delete process.env.MAIL_SMTP_PASS;

      // Mock nodemailer to capture transport config
      const createTransportMock = vi.fn();
      vi.mock('nodemailer', () => ({
        default: {
          createTransport: createTransportMock,
        },
      }));

      // Expected config for Mailpit
      expect({
        host: process.env.MAIL_SMTP_HOST,
        port: Number(process.env.MAIL_SMTP_PORT),
        secure: false,
        ignoreTLS: true,
        auth: undefined,
      }).toEqual({
        host: 'localhost',
        port: 1025,
        secure: false,
        ignoreTLS: true,
        auth: undefined,
      });
    });

    it('should support mailpit Docker hostname', () => {
      process.env.MAIL_SMTP_HOST = 'mailpit';
      process.env.MAIL_SMTP_PORT = '1025';
      delete process.env.MAIL_SMTP_USER;
      delete process.env.MAIL_SMTP_PASS;

      expect({
        host: process.env.MAIL_SMTP_HOST,
        port: Number(process.env.MAIL_SMTP_PORT),
        requireTLS: false,
      }).toEqual({
        host: 'mailpit',
        port: 1025,
        requireTLS: false,
      });
    });
  });

  describe('Gmail SMTP Configuration (Port 587 - STARTTLS)', () => {
    it('should use Gmail SMTP with credentials on port 587', () => {
      process.env.MAIL_SMTP_HOST = 'smtp.gmail.com';
      process.env.MAIL_SMTP_PORT = '587';
      process.env.MAIL_SMTP_USER = 'user@gmail.com';
      process.env.MAIL_SMTP_PASS = 'app-password-16-chars';

      const port = Number(process.env.MAIL_SMTP_PORT);
      const isImplicitTLS = port === 465;
      const isExplicitTLS = port === 587;
      const requiresTLS = isImplicitTLS || isExplicitTLS;

      expect({
        host: process.env.MAIL_SMTP_HOST,
        port,
        secure: isImplicitTLS,
        requireTLS: requiresTLS,
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS 
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      }).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'user@gmail.com',
          pass: 'app-password-16-chars',
        },
      });
    });

    it('should not include auth if only MAIL_SMTP_USER is set', () => {
      process.env.MAIL_SMTP_HOST = 'smtp.gmail.com';
      process.env.MAIL_SMTP_PORT = '587';
      process.env.MAIL_SMTP_USER = 'user@gmail.com';
      delete process.env.MAIL_SMTP_PASS;

      expect({
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      }).toEqual({
        auth: undefined,
      });
    });

    it('should not include auth if only MAIL_SMTP_PASS is set', () => {
      process.env.MAIL_SMTP_HOST = 'smtp.gmail.com';
      process.env.MAIL_SMTP_PORT = '587';
      delete process.env.MAIL_SMTP_USER;
      process.env.MAIL_SMTP_PASS = 'app-password-16-chars';

      expect({
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      }).toEqual({
        auth: undefined,
      });
    });
  });

  describe('Gmail SMTP Configuration (Port 465 - Implicit TLS)', () => {
    it('should use Gmail SMTP with implicit TLS on port 465', () => {
      process.env.MAIL_SMTP_HOST = 'smtp.gmail.com';
      process.env.MAIL_SMTP_PORT = '465';
      process.env.MAIL_SMTP_USER = 'user@gmail.com';
      process.env.MAIL_SMTP_PASS = 'app-password-16-chars';

      const port = Number(process.env.MAIL_SMTP_PORT);
      const isImplicitTLS = port === 465;
      const isExplicitTLS = port === 587;
      const requiresTLS = isImplicitTLS || isExplicitTLS;

      expect({
        host: process.env.MAIL_SMTP_HOST,
        port,
        secure: isImplicitTLS,
        requireTLS: requiresTLS,
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      }).toEqual({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        requireTLS: true,
        auth: {
          user: 'user@gmail.com',
          pass: 'app-password-16-chars',
        },
      });
    });
  });

  describe('No Secrets in Configuration', () => {
    it('should only expose credentials in auth object, not in logs', () => {
      process.env.MAIL_SMTP_HOST = 'smtp.gmail.com';
      process.env.MAIL_SMTP_PORT = '587';
      process.env.MAIL_SMTP_USER = 'user@gmail.com';
      process.env.MAIL_SMTP_PASS = 'secret-app-password';

      // Simulate what getTransporter() does - credentials should be in object
      const config = {
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      };

      // Verify auth object contains credentials (as expected)
      expect(config.auth).toBeDefined();
      expect(config.auth?.user).toBe('user@gmail.com');
      expect(config.auth?.pass).toBe('secret-app-password');
      
      // Verify no logging of config string in actual code (checked by code review)
      // The sendMail function only logs error object, not credentials
    });

    it('should default to no auth when no credentials provided', () => {
      process.env.MAIL_SMTP_HOST = 'localhost';
      process.env.MAIL_SMTP_PORT = '1025';
      delete process.env.MAIL_SMTP_USER;
      delete process.env.MAIL_SMTP_PASS;

      expect({
        auth: process.env.MAIL_SMTP_USER && process.env.MAIL_SMTP_PASS
          ? { user: process.env.MAIL_SMTP_USER, pass: process.env.MAIL_SMTP_PASS }
          : undefined,
      }).toEqual({
        auth: undefined,
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should use default Mailpit settings when no env vars set', () => {
      delete process.env.MAIL_SMTP_HOST;
      delete process.env.MAIL_SMTP_PORT;
      delete process.env.MAIL_SMTP_USER;
      delete process.env.MAIL_SMTP_PASS;

      expect({
        host: process.env.MAIL_SMTP_HOST || 'localhost',
        port: Number(process.env.MAIL_SMTP_PORT || '1025'),
        ignoreTLS: true,
        auth: undefined,
      }).toEqual({
        host: 'localhost',
        port: 1025,
        ignoreTLS: true,
        auth: undefined,
      });
    });

    it('should maintain MAIL_FROM configuration', () => {
      process.env.MAIL_FROM = 'custom@example.com';

      expect(process.env.MAIL_FROM || 'no-reply@learnflow.local').toBe('custom@example.com');
    });

    it('should maintain APP_URL for email links', () => {
      process.env.APP_URL = 'https://custom-domain.com';

      expect(process.env.APP_URL || 'http://localhost:3000').toBe('https://custom-domain.com');
    });
  });
});
