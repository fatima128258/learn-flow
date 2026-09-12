CREATE TYPE "ModuleContentType" AS ENUM ('LESSON', 'QUIZ');

CREATE TABLE "ModuleContentItem" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" "ModuleContentType" NOT NULL,
    "lessonId" TEXT,
    "quizId" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "ModuleContentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleContentItem_moduleId_position_key" ON "ModuleContentItem"("moduleId", "position");
CREATE UNIQUE INDEX "ModuleContentItem_moduleId_lessonId_key" ON "ModuleContentItem"("moduleId", "lessonId");
CREATE UNIQUE INDEX "ModuleContentItem_moduleId_quizId_key" ON "ModuleContentItem"("moduleId", "quizId");
CREATE INDEX "ModuleContentItem_moduleId_position_idx" ON "ModuleContentItem"("moduleId", "position");
ALTER TABLE "ModuleContentItem" ADD CONSTRAINT "ModuleContentItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleContentItem" ADD CONSTRAINT "ModuleContentItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleContentItem" ADD CONSTRAINT "ModuleContentItem_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleContentItem" ADD CONSTRAINT "ModuleContentItem_type_target_check"
  CHECK (("type" = 'LESSON' AND "lessonId" IS NOT NULL AND "quizId" IS NULL)
      OR ("type" = 'QUIZ' AND "quizId" IS NOT NULL AND "lessonId" IS NULL));

-- Preserve existing ordering. Ties are deterministic and lessons precede quizzes.
INSERT INTO "ModuleContentItem" ("id", "moduleId", "type", "lessonId", "position")
SELECT 'content_' || l."id", l."moduleId", 'LESSON', l."id",
       ROW_NUMBER() OVER (PARTITION BY l."moduleId" ORDER BY l."order", l."id") - 1
FROM "Lesson" l;
INSERT INTO "ModuleContentItem" ("id", "moduleId", "type", "quizId", "position")
SELECT 'content_' || q."id", q."moduleId", 'QUIZ', q."id",
       (SELECT COUNT(*) FROM "Lesson" l WHERE l."moduleId" = q."moduleId")
       + ROW_NUMBER() OVER (PARTITION BY q."moduleId" ORDER BY q."order", q."id") - 1
FROM "Quiz" q;
