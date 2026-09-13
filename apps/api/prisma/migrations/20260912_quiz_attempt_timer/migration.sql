-- Persist the server-authoritative quiz attempt lifecycle and expiry.
ALTER TABLE "QuizAttempt"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "QuizAttempt"
  ALTER COLUMN "score" DROP NOT NULL,
  ALTER COLUMN "correctCount" DROP NOT NULL,
  ALTER COLUMN "incorrectCount" DROP NOT NULL,
  ALTER COLUMN "percentage" DROP NOT NULL,
  ALTER COLUMN "passed" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP NOT NULL;

UPDATE "QuizAttempt"
SET
  "status" = 'COMPLETED',
  "startedAt" = COALESCE("createdAt", "submittedAt")
WHERE "submittedAt" IS NOT NULL;
