ALTER TABLE "Conversation" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Conversation" c SET "organizationId" = co."organizationId" FROM "Course" co WHERE c."courseId" = co."id";
ALTER TABLE "Conversation" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Conversation_organizationId_idx" ON "Conversation"("organizationId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
