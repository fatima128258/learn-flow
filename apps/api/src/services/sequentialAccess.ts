import getPrisma from '../prisma';
import * as sequenceRepo from '../repositories/contentSequenceRepository';
import * as progressRepo from '../repositories/progressRepository';

type SequenceRow = { type: 'LESSON' | 'QUIZ'; id: string; position: number };

async function courseSequence(courseId: string) {
  const modules = await getPrisma().module.findMany({
    where: { courseId },
    select: { id: true, order: true },
    orderBy: { order: 'asc' },
  });
  const rows: Array<SequenceRow & { moduleId: string }> = [];
  for (const module of modules) {
    const items = await sequenceRepo.listByModule(module.id);
    for (const row of items as any[]) {
      const id = row.type === 'LESSON' ? row.lessonId : row.quizId;
      if (id) rows.push({ moduleId: module.id, type: row.type, id, position: row.position });
    }
  }
  return rows;
}

export async function getSequenceState(userId: string, courseId: string) {
  const sequence = await courseSequence(courseId);
  if (sequence.length === 0) return [];
  const [lessons, attempts] = await Promise.all([
    progressRepo.listLessonProgressForCourse(userId, courseId),
    progressRepo.listAttemptsForCourse(userId, courseId),
  ]);
  const completedLessons = new Set(lessons.map((row: { lessonId: string }) => row.lessonId));
  const passedQuizzes = new Set(attempts.filter((row: { passed: boolean }) => row.passed).map((row: { quizId: string }) => row.quizId));
  let previousComplete = true;
  return sequence.map((item: SequenceRow & { moduleId: string }) => {
    const completed = item.type === 'LESSON'
      ? completedLessons.has(item.id)
      : passedQuizzes.has(item.id);
    const state = completed ? 'completed' : previousComplete ? 'current' : 'locked';
    if (!completed) previousComplete = false;
    return { ...item, completed, state, unlocked: state !== 'locked' };
  });
}

export async function assertContentUnlocked(
  userId: string,
  courseId: string,
  moduleId: string,
  type: 'LESSON' | 'QUIZ',
  contentId: string,
) {
  const state = await getSequenceState(userId, courseId);
  if (state.length === 0) throw new Error('CONTENT_SEQUENCE_MISSING');
  const item = state.find((row: SequenceRow & { moduleId: string; state: string }) => row.moduleId === moduleId && row.type === type && row.id === contentId);
  if (!item) throw new Error(type === 'LESSON' ? 'LESSON_NOT_FOUND' : 'QUIZ_NOT_FOUND');
  if (item.state === 'locked') throw new Error('CONTENT_LOCKED');
  return item;
}
