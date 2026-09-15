import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/orgAdminRepository', () => ({
  listStudentProgressEnrollments: vi.fn(),
}));

vi.mock('../services/progressService', () => ({
  getCourseProgress: vi.fn(),
}));

import * as orgAdminRepo from '../repositories/orgAdminRepository';
import * as progressService from '../services/progressService';
import { listStudentProgress } from '../services/orgAdminService';

const enrollments = [
  { id: 'enrollment-1', user_id: 'student-1', student_name: 'A', student_email: 'a@example.com', course_id: 'course-1', course_name: 'Course 1', enrolled_at: new Date('2026-01-03') },
  { id: 'enrollment-2', user_id: 'student-2', student_name: 'B', student_email: 'b@example.com', course_id: 'course-2', course_name: 'Course 2', enrolled_at: new Date('2026-01-02') },
  { id: 'enrollment-3', user_id: 'student-3', student_name: 'C', student_email: 'c@example.com', course_id: 'course-3', course_name: 'Course 3', enrolled_at: new Date('2026-01-01') },
];

function progress(courseId: string) {
  const values: Record<string, { coursePercentage: number; courseComplete: boolean }> = {
    'course-1': { coursePercentage: 0, courseComplete: false },
    'course-2': { coursePercentage: 50, courseComplete: false },
    'course-3': { coursePercentage: 100, courseComplete: true },
  };
  return {
    ...values[courseId],
    certificateEligible: values[courseId].courseComplete,
    lastVisited: null,
    modules: [],
    quizzes: [],
  };
}

describe('organization student progress filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgAdminRepo.listStudentProgressEnrollments).mockResolvedValue({
      items: enrollments,
      total: enrollments.length,
    });
    vi.mocked(progressService.getCourseProgress).mockImplementation(async (_organizationId, _userId, courseId) =>
      progress(courseId) as unknown as Awaited<ReturnType<typeof progressService.getCourseProgress>>,
    );
  });

  it.each([
    ['ALL', 3, 3],
    ['NOT_STARTED', 1, 1],
    ['IN_PROGRESS', 1, 1],
    ['COMPLETED', 1, 1],
  ])('returns the correct result and total for %s', async (status, expectedItems, expectedTotal) => {
    const result = await listStudentProgress('org-a', { progressStatus: status, page: 1, limit: 10 });
    expect(result.items).toHaveLength(expectedItems);
    expect(result.meta.total).toBe(expectedTotal);
  });

  it('paginates after filtering instead of filtering an unfiltered page', async () => {
    const result = await listStudentProgress('org-a', { progressStatus: 'COMPLETED', page: 2, limit: 1 });
    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(orgAdminRepo.listStudentProgressEnrollments).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
    }));
  });

  it('preserves search and instructor course scope while filtering', async () => {
    await listStudentProgress('org-a', {
      progressStatus: 'IN_PROGRESS',
      search: 'student',
      courseId: 'course-2',
    }, 'instructor-1');
    expect(orgAdminRepo.listStudentProgressEnrollments).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      instructorUserId: 'instructor-1',
      search: 'student',
      courseId: 'course-2',
    }));
  });
});
