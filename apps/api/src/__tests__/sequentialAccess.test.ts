import { beforeEach, describe, expect, it, vi } from 'vitest';

const { moduleFindMany, sequenceList, lessonProgress, attempts } = vi.hoisted(() => ({
  moduleFindMany: vi.fn(),
  sequenceList: vi.fn(),
  lessonProgress: vi.fn(),
  attempts: vi.fn(),
}));

vi.mock('../prisma', () => ({ default: () => ({ module: { findMany: moduleFindMany } }) }));
vi.mock('../repositories/contentSequenceRepository', () => ({ listByModule: sequenceList }));
vi.mock('../repositories/progressRepository', () => ({
  listLessonProgressForCourse: lessonProgress,
  listAttemptsForCourse: attempts,
}));

import { assertContentUnlocked, getSequenceState } from '../services/sequentialAccess';

describe('student sequential access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moduleFindMany.mockResolvedValue([{ id: 'module-1', order: 0 }]);
    sequenceList.mockResolvedValue([
      { type: 'LESSON', lessonId: 'lesson-1', quizId: null, position: 0 },
      { type: 'QUIZ', lessonId: null, quizId: 'quiz-1', position: 1 },
      { type: 'LESSON', lessonId: 'lesson-2', quizId: null, position: 2 },
    ]);
    lessonProgress.mockResolvedValue([]);
    attempts.mockResolvedValue([]);
  });

  it('locks mixed sequence items and unlocks after lesson and passed quiz', async () => {
    expect((await getSequenceState('student-1', 'course-1')).map(item => item.state))
      .toEqual(['current', 'locked', 'locked']);

    lessonProgress.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    attempts.mockResolvedValue([{ quizId: 'quiz-1', passed: true }]);
    expect((await getSequenceState('student-1', 'course-1')).map(item => item.state))
      .toEqual(['completed', 'completed', 'current']);
  });

  it('denies direct access to locked, wrong, and missing sequence content', async () => {
    await expect(assertContentUnlocked('student-1', 'course-1', 'module-1', 'QUIZ', 'quiz-1'))
      .rejects.toThrow('CONTENT_LOCKED');
    await expect(assertContentUnlocked('student-1', 'course-1', 'module-1', 'LESSON', 'other'))
      .rejects.toThrow('LESSON_NOT_FOUND');
    moduleFindMany.mockResolvedValue([]);
    await expect(assertContentUnlocked('student-1', 'wrong-course', 'wrong-module', 'LESSON', 'lesson-1'))
      .rejects.toThrow('CONTENT_SEQUENCE_MISSING');
  });

  it('never bypasses access when persisted sequence is missing', async () => {
    moduleFindMany.mockResolvedValue([{ id: 'module-1', order: 0 }]);
    sequenceList.mockResolvedValue([]);
    await expect(assertContentUnlocked('student-1', 'course-1', 'module-1', 'LESSON', 'lesson-1'))
      .rejects.toThrow('CONTENT_SEQUENCE_MISSING');
  });
});
