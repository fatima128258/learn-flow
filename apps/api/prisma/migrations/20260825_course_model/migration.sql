-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instructorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "discountPrice" DECIMAL(10,2),
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "difficulty" TEXT,
    "learningObjectives" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_organizationId_slug_key" ON "Course"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Course_organizationId_status_idx" ON "Course"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorUserId_fkey" FOREIGN KEY ("instructorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
