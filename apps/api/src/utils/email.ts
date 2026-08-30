import nodemailer from 'nodemailer';
import { NotificationType } from '@prisma/client';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationEmailContext {
  to: string;
  name?: string | null;
  courseTitle?: string | null;
  organizationName?: string | null;
  verifyUrl?: string;
  resetUrl?: string;
  certificateUrl?: string;
}

function layout(title: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <p style="color: #9CA3AF; font-size: 12px;">Sent by LearnFlow</p>
    </div>
  `;
}

export function buildNotificationEmail(type: NotificationType, ctx: NotificationEmailContext) {
  const course = ctx.courseTitle ?? 'course';
  const org = ctx.organizationName ?? 'your organization';
  const greeting = ctx.name ? `Hi ${ctx.name},` : 'Hi there,';

  switch (type) {
    case 'ENROLLMENT_CONFIRMATION':
      return {
        subject: `Enrollment confirmed: ${course}`,
        html: layout('Enrollment confirmed', `
          <p>${greeting}</p>
          <p>You have been enrolled in <strong>${course}</strong> at ${org}.</p>
          <p>You can start learning right away from your dashboard.</p>
        `),
      };
    case 'COURSE_PURCHASED':
      return {
        subject: `Purchase confirmed: ${course}`,
        html: layout('Purchase confirmed', `
          <p>${greeting}</p>
          <p>Your purchase and enrollment for <strong>${course}</strong> at ${org} were successful.</p>
          <p>You can now access all lessons and materials.</p>
        `),
      };
    case 'COURSE_COMPLETION':
      return {
        subject: `Congratulations! You completed ${course}`,
        html: layout('Course completed', `
          <p>${greeting}</p>
          <p>Congratulations on completing <strong>${course}</strong> at ${org}.</p>
          <p>You can now generate your certificate from your dashboard.</p>
        `),
      };
    case 'CERTIFICATE_GENERATED':
      return {
        subject: `Your certificate for ${course} is ready`,
        html: layout('Certificate generated', `
          <p>${greeting}</p>
          <p>Your certificate for <strong>${course}</strong> has been generated.</p>
          ${ctx.certificateUrl ? `<p><a href="${ctx.certificateUrl}" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:white;text-decoration:none;border-radius:6px;">View Certificate</a></p>` : ''}
        `),
      };
    case 'COURSE_PUBLISHED':
      return {
        subject: `Your course "${course}" is published`,
        html: layout('Course published', `
          <p>${greeting}</p>
          <p>Great news — your course <strong>${course}</strong> at ${org} is now published and available to students.</p>
        `),
      };
    case 'WELCOME':
      return {
        subject: `Welcome to LearnFlow`,
        html: layout('Welcome', `
          <p>${greeting}</p>
          <p>Your LearnFlow account is ready at ${org}.</p>
        `),
      };
    case 'PASSWORD_RESET':
      return {
        subject: 'Your password was reset',
        html: layout('Password reset', `
          <p>${greeting}</p>
          <p>Your LearnFlow password has been reset successfully. If this wasn't you, please contact support.</p>
        `),
      };
    default:
      return { subject: 'LearnFlow notification', html: layout('Notification', `<p>${greeting}</p>`) };
  }
}

export async function sendNotificationEmail(type: NotificationType, ctx: NotificationEmailContext) {
  const { subject, html } = buildNotificationEmail(type, ctx);
  return sendMail({ to: ctx.to, subject, html });
}

let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (!transporter) {
    const host = process.env.MAIL_SMTP_HOST || 'localhost';
    const port = Number(process.env.MAIL_SMTP_PORT || '1025');

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