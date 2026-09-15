ALTER TABLE "PasswordResetToken"
ADD COLUMN IF NOT EXISTS "codeHash" TEXT,
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_used_idx"
ON "PasswordResetToken"("userId", "used");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_expiresAt_idx"
ON "PasswordResetToken"("userId", "expiresAt");
