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
  return prisma().lesson.update({
    where: { id: lessonId },
    data,
  });
}

export async function deleteLesson(moduleId: string, lessonId: string) {
  return prisma().lesson.delete({
    where: { id: lessonId },
  });
}