import getPrisma from '../prisma';

export async function listByModule(moduleId: string) {
  const db = getPrisma();
  if (!db.moduleContentItem) return [];
  return db.moduleContentItem.findMany({
    where: { moduleId },
    include: { lesson: true, quiz: true },
    orderBy: { position: 'asc' },
  });
}

export async function replace(moduleId: string, items: Array<{ type: 'LESSON' | 'QUIZ'; lessonId?: string; quizId?: string }>) {
  const db = getPrisma();
  if (!db.moduleContentItem) throw new Error('CONTENT_SEQUENCE_UNAVAILABLE');
  return db.$transaction(async (tx) => {
    await tx.moduleContentItem.deleteMany({ where: { moduleId } });
    return Promise.all(items.map((item, position) => tx.moduleContentItem.create({
      data: { moduleId, type: item.type, lessonId: item.lessonId, quizId: item.quizId, position },
    })));
  });
}

export async function removeLesson(lessonId: string) {
  const db = getPrisma();
  if (!db.moduleContentItem) return { count: 0 };
  return db.moduleContentItem.deleteMany({ where: { lessonId } });
}

export async function removeQuiz(quizId: string) {
  const db = getPrisma();
  if (!db.moduleContentItem) return { count: 0 };
  return db.moduleContentItem.deleteMany({ where: { quizId } });
}

export async function append(moduleId: string, item: { type: 'LESSON' | 'QUIZ'; id: string }) {
  const db = getPrisma();
  if (!db.moduleContentItem) return null;
  const position = await db.moduleContentItem.count({ where: { moduleId } });
  return db.moduleContentItem.create({
    data: {
      moduleId,
      type: item.type,
      lessonId: item.type === 'LESSON' ? item.id : undefined,
      quizId: item.type === 'QUIZ' ? item.id : undefined,
      position,
    },
  });
}
