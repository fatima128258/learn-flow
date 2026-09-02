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
  // Use updateMany so the WHERE clause is atomically bound to BOTH moduleId AND
  // courseId. A plain update({ where: { id } }) would mutate any module in the
  // database regardless of which course it belongs to.
  const result = await prisma().module.updateMany({
    where: { id: moduleId, courseId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().module.findFirst({ where: { id: moduleId, courseId } });
}

export async function deleteModule(courseId: string, moduleId: string) {
  // Use deleteMany so the WHERE clause is atomically bound to BOTH moduleId AND
  // courseId. A plain delete({ where: { id } }) would delete any module in the
  // database regardless of which course it belongs to.
  const result = await prisma().module.deleteMany({
    where: { id: moduleId, courseId },
  });
  return result;
}