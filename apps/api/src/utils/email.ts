import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (!transporter) {
    const host = process.env.MAIL_SMTP_HOST || 'localhost';
    const port = Number(process.env.MAIL_SMTP_PORT || '1025');
    const from = process.env.MAIL_FROM || 'no-reply@learnflow.local';

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true, // Mailpit doesn't require TLS
      auth: undefined, // No auth for local Mailpit
    });
  }
  return transporter;
}

export async function sendMail(options: MailOptions) {
  const from = process.env.MAIL_FROM || 'no-reply@learnflow.local';
  const transport = getTransporter();

  try {
    await transport.sendMail({
      from,
      ...options,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  return sendMail({
    to: email,
    subject: 'Verify your LearnFlow account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to LearnFlow!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #6B7280;">${verifyUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  return sendMail({
    to: email,
    subject: 'Reset your LearnFlow password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #6B7280;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
    `,
  });
}