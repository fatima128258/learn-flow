-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_name_key" ON "Category"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_slug_key" ON "Category"("organizationId", "slug");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill categories from the existing free-text Course.category values (per organization)
INSERT INTO "Category" ("id", "organizationId", "name", "slug", "description", "createdAt", "updatedAt")
SELECT
    'cat_' || replace(md5(concat("organizationId", '|', btrim("category"))), '-', ''),
    "organizationId",
    btrim("category"),
    lower(
        coalesce(
            nullif(
                regexp_replace(regexp_replace(btrim("category"), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', ''),
                ''
            ),
            'category'
        )
    ) || '-' || substring(md5(concat("organizationId", '|', btrim("category"))) from 1 for 8),
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Course"
WHERE "category" IS NOT NULL AND btrim("category") <> ''
GROUP BY "organizationId", btrim("category");

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Course_categoryId_idx" ON "Course"("categoryId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Course.categoryId from the promoted categories
UPDATE "Course" c
SET "categoryId" = cat."id"
FROM "Category" cat
WHERE c."category" IS NOT NULL
  AND btrim(c."category") = cat."name"
  AND c."organizationId" = cat."organizationId";

-- DropColumn
ALTER TABLE "Course" DROP COLUMN "category";