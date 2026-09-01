import * as searchRepo from '../repositories/searchRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import { categoryLabel } from '../utils/categoryLabel';
import { parsePagination, parseSort, buildMeta } from '../utils/pagination';

function optionalFilter(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('INVALID_QUERY');
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('INVALID_QUERY');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('INVALID_QUERY');
  return parsed;
}

function toCourseSearchDto(course: {
  id: string;
  organizationId: string;
  instructorUser?: { id: string; name: string | null } | null;
  instructorUserId: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: unknown;
  difficulty: string | null;
  price: unknown;
  discountPrice: unknown;
  estimatedMinutes: number | null;
  learningObjectives: string[];
  status: string;
  publishedAt: Date | null;
}, isEnrolled = false) {
  return {
    id: course.id,
    organizationId: course.organizationId,
    instructor: {
      id: course.instructorUser?.id ?? course.instructorUserId,
      name: course.instructorUser?.name ?? null,
    },
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: categoryLabel(course.category),
    difficulty: course.difficulty,
    price: course.price,
    discountPrice: course.discountPrice,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
    status: course.status,
    publishedAt: course.publishedAt,
    isEnrolled,
  };
}

export async function searchCourses(organizationId: string, userId: string, rawInput: unknown) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const query = optionalFilter(input.q);
  const category = optionalFilter(input.category);
  const difficulty = optionalFilter(input.difficulty);
  const instructor = optionalFilter(input.instructor);
  const minPrice = optionalNumber(input.minPrice);
  const maxPrice = optionalNumber(input.maxPrice);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new Error('INVALID_QUERY');
  }
  const filters = { query, category, difficulty, instructor, minPrice, maxPrice };

  const { page, limit, skip, take } = parsePagination(input);
  const orderBy = parseSort(input.sort, input.order, [
    { field: 'publishedAt', defaultOrder: 'desc' },
    { field: 'title' },
    { field: 'price' },
    { field: 'difficulty' },
    { field: 'createdAt' },
  ]);

  const [results, total] = await Promise.all([
    searchRepo.searchPublishedCourses(organizationId, filters, { skip, take, orderBy }),
    searchRepo.countPublishedCourses(organizationId, filters),
  ]);

  // Get enrollment status for each course for the current user
  const courseIds = results.map(course => course.id);
  const enrollments = await Promise.all(
    courseIds.map(courseId => enrollmentRepo.findByUserAndCourse(userId, courseId))
  );

  // Create lookup map for efficient enrollment checking
  const enrollmentMap = new Map<string, boolean>();
  enrollments.forEach((enrollment, index) => {
    if (enrollment && enrollment.organizationId === organizationId) {
      enrollmentMap.set(courseIds[index], true);
    }
  });

  return {
    items: results.map(course => 
      toCourseSearchDto(course, enrollmentMap.get(course.id) || false)
    ),
    meta: buildMeta(page, limit, total),
  };
}
