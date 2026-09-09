ALTER TABLE "Category" ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Category"
ADD CONSTRAINT "Category_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Category_organizationId_name_key";
DROP INDEX IF EXISTS "Category_organizationId_slug_key";
CREATE UNIQUE INDEX "Category_organization_name_key" ON "Category" ("organizationId", "name") WHERE "ownerUserId" IS NULL;
CREATE UNIQUE INDEX "Category_organization_slug_key" ON "Category" ("organizationId", "slug") WHERE "ownerUserId" IS NULL;
CREATE UNIQUE INDEX "Category_private_owner_name_key" ON "Category" ("organizationId", "ownerUserId", "name") WHERE "ownerUserId" IS NOT NULL;
CREATE UNIQUE INDEX "Category_private_owner_slug_key" ON "Category" ("organizationId", "ownerUserId", "slug") WHERE "ownerUserId" IS NOT NULL;
CREATE INDEX "Category_organization_ownerUserId_idx" ON "Category" ("organizationId", "ownerUserId");
