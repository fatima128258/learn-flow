import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateModuleData {
  courseId: string;
  title: string;
  description?: string | null;
  order: number;
}

export async function createModule(data: CreateModuleData) {
  return prisma().module.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      description: data.description,
      order: data.order,
    },
  });
}

export async function listByCourse(courseId: string) {
  return prisma().module.findMany({
    where: { courseId },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: 'asc' },
  });
}

export async function getById(courseId: string, moduleId: string) {
  return prisma().module.findFirst({
    where: { id: moduleId, courseId },
  });
}

export async function updateModule(courseId: string, moduleId: string, data: { title?: string; description?: string | null; order?: number }) {
  return prisma().module.update({
    where: { id: moduleId },
    data,
  });
}

export async function deleteModule(courseId: string, moduleId: string) {
  return prisma().module.delete({
    where: { id: moduleId },
  });
}