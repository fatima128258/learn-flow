import * as searchRepo from '../repositories/searchRepository';
import { parsePagination, parseSort, buildMeta } from '../utils/pagination';

function optionalFilter(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('INVALID_QUERY');
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function toCourseSearchDto(course: any) {
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
    category: course.category,
    difficulty: course.difficulty,
    price: course.price,
    discountPrice: course.discountPrice,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
    status: course.status,
    publishedAt: course.publishedAt,
  };
}

export async function searchCourses(organizationId: string, rawInput: unknown) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const query = optionalFilter(input.q);
  const category = optionalFilter(input.category);
  const difficulty = optionalFilter(input.difficulty);
  const filters = { query, category, difficulty };

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

  return {
    items: results.map(toCourseSearchDto),
    meta: buildMeta(page, limit, total),
  };
}
