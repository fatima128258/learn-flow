ALTER TABLE "PasswordResetToken"
ADD COLUMN "codeHash" TEXT,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "usedAt" TIMESTAMP(3);

CREATE INDEX "PasswordResetToken_userId_used_idx"
ON "PasswordResetToken"("userId", "used");

CREATE INDEX "PasswordResetToken_userId_expiresAt_idx"
ON "PasswordResetToken"("userId", "expiresAt");
