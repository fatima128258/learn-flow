import getPrisma from '../prisma';

function prisma() { return getPrisma(); }

export async function findUserByEmail(email: string) {
  return prisma().user.findUnique({ where: { email } });
}

export async function findUserOrganizationsByUserId(userId: string) {
  return prisma().userOrganization.findMany({ where: { userId } });
}

export async function findUserById(id: string) {
  return prisma().user.findUnique({ where: { id } });
}

export async function createUser(data: { name?: string | null; email: string; passwordHash: string }) {
  return prisma().user.create({ data });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  return prisma().user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function updateUserEmail(userId: string, email: string) {
  return prisma().user.update({ where: { id: userId }, data: { email, emailVerified: false } });
}

export async function markUserEmailAsVerified(userId: string) {
  return prisma().user.update({ where: { id: userId }, data: { emailVerified: true } });
}

export async function updateUserProfile(userId: string, data: { name?: string | null }) {
  return prisma().user.update({ where: { id: userId }, data });
}

// Session functions
export async function createSession(data: { userId: string; tokenHash: string; expiresAt: Date }) {
  return prisma().session.create({ data });
}

export async function findSessionByTokenHash(tokenHash: string) {
  return prisma().session.findUnique({ where: { tokenHash } });
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  return prisma().session.update({ where: { tokenHash }, data: { revoked: true } });
}

export async function revokeSessionById(id: string) {
  return prisma().session.update({ where: { id }, data: { revoked: true } });
}

export async function deleteSessionById(id: string) {
  return prisma().session.delete({ where: { id } });
}

export async function revokeAllSessionsByUserId(userId: string) {
  return prisma().session.updateMany({ where: { userId }, data: { revoked: true } });
}

export async function revokeOtherSessionsByUserId(userId: string, keepTokenHash: string) {
  return prisma().session.updateMany({
    where: { userId, tokenHash: { not: keepTokenHash } },
    data: { revoked: true },
  });
}

// Email Verification Token functions
export async function createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
  return prisma().emailVerificationToken.create({ data });
}

export async function findEmailVerificationTokenByTokenHash(tokenHash: string) {
  return prisma().emailVerificationToken.findUnique({ where: { tokenHash } });
}

export async function markEmailVerificationTokenAsUsed(id: string) {
  return prisma().emailVerificationToken.update({ where: { id }, data: { used: true } });
}

export async function deleteEmailVerificationTokensByUserId(userId: string) {
  return prisma().emailVerificationToken.deleteMany({ where: { userId, used: false, expiresAt: { gt: new Date() } } });
}

// Password Reset Token functions
export async function createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
  return prisma().passwordResetToken.create({ data });
}

export async function findPasswordResetTokenByTokenHash(tokenHash: string) {
  return prisma().passwordResetToken.findUnique({ where: { tokenHash } });
}

export async function markPasswordResetTokenAsUsed(id: string) {
  return prisma().passwordResetToken.update({ where: { id }, data: { used: true } });
}

export async function deletePasswordResetTokensByUserId(userId: string) {
  return prisma().passwordResetToken.deleteMany({ where: { userId, used: false, expiresAt: { gt: new Date() } } });
}
