CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "UserOrganization"
ADD COLUMN "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "UserOrganization_organizationId_status_idx"
ON "UserOrganization"("organizationId", "status");
