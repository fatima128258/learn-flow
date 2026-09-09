CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Category" ADD COLUMN "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Category_organizationId_status_idx" ON "Category"("organizationId", "status");
