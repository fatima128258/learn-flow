import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateLessonData {
  moduleId: string;
  title: string;
  description?: string | null;
  content?: string | null;
  type?: string | null;
  resourceUrl?: string | null;
  resourceMimeType?: string | null;
  duration?: number | null;
  order: number;
  isPreview?: boolean;
}

export async function createLesson(data: CreateLessonData) {
  return prisma().lesson.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description,
      content: data.content,
      type: data.type,
      resourceUrl: data.resourceUrl,
      resourceMimeType: data.resourceMimeType,
      duration: data.duration,
      order: data.order,
      isPreview: data.isPreview ?? false,
    },
  });
}

export async function listByModule(moduleId: string) {
  return prisma().lesson.findMany({
    where: { moduleId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      duration: true,
      order: true,
      isPreview: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: 'asc' },
  });
}

export async function getById(moduleId: string, lessonId: string) {
  return prisma().lesson.findFirst({
    where: { id: lessonId, moduleId },
  });
}

export async function updateLesson(moduleId: string, lessonId: string, data: {
  title?: string;
  description?: string | null;
  content?: string | null;
  type?: string | null;
  resourceUrl?: string | null;
  resourceMimeType?: string | null;
  duration?: number | null;
  order?: number;
  isPreview?: boolean;
}) {
  // Use updateMany so the WHERE clause is atomically bound to BOTH lessonId AND
  // moduleId. A plain update({ where: { id } }) would mutate any lesson in the
  // database regardless of which module it belongs to.
  const result = await prisma().lesson.updateMany({
    where: { id: lessonId, moduleId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().lesson.findFirst({ where: { id: lessonId, moduleId } });
}

export async function deleteLesson(moduleId: string, lessonId: string) {
  // Use deleteMany so the WHERE clause is atomically bound to BOTH lessonId AND
  // moduleId. A plain delete({ where: { id } }) would delete any lesson in the
  // database regardless of which module it belongs to.
  const result = await prisma().lesson.deleteMany({
    where: { id: lessonId, moduleId },
  });
  return result;
}