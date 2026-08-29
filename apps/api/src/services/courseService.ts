import { Prisma } from '@prisma/client';
import * as courseRepo from '../repositories/courseRepository';
import * as categoryService from './categoryService';
import { categoryLabel } from '../utils/categoryLabel';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';
import * as storage from '../storage';
import { parsePagination, parseSort, buildMeta } from '../utils/pagination';

const VALID_COURSE_STATUSES = new Set(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);

const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 50;

function isValidSlug(slug: string) {
  if (typeof slug !== 'string') return false;
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requireTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  return value.trim();
}

function resolveSlug(rawSlug: unknown, title: string) {
  const slug =
    typeof rawSlug === 'string' && rawSlug.trim()
      ? rawSlug.trim().toLowerCase()
      : slugify(title);
  if (!isValidSlug(slug)) {
    throw new Error('INVALID_SLUG');
  }
  return slug;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('MISSING_FIELDS');
  return value.trim();
}

function optionalMoney(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('MISSING_FIELDS');
  return parsed;
}

function optionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('MISSING_FIELDS');
  return parsed;
}

function optionalStringList(value: unknown) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return [];
  }
  if (!Array.isArray(value)) throw new Error('MISSING_FIELDS');
  return value.map((item) => {
    if (typeof item !== 'string') throw new Error('MISSING_FIELDS');
    return item.trim();
  });
}

function toCourseDto(course: any) {
  return {
    id: course.id,
    organizationId: course.organizationId,
    instructorUserId: course.instructorUserId,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: categoryLabel(course.category),
    categoryId: course.categoryId ?? null,
    price: course.price,
    discountPrice: course.discountPrice,
    status: course.status,
    publishedAt: course.publishedAt,
    estimatedMinutes: course.estimatedMinutes,
    difficulty: course.difficulty,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toCourseListItemDto(course: any) {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    status: course.status,
    difficulty: course.difficulty,
    createdAt: course.createdAt,
  };
}

export async function getCourse(organizationId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  return toCourseDto(course);
}

export async function listCourses(
  organizationId: string,
  input: { page?: unknown; limit?: unknown; status?: unknown; sort?: unknown; order?: unknown } = {},
) {
  let status: string | undefined;
  if (input.status !== undefined && input.status !== null && input.status !== '') {
    const rawStatus = String(input.status).toUpperCase();
    if (!VALID_COURSE_STATUSES.has(rawStatus)) {
      throw new Error('INVALID_STATUS');
    }
    status = rawStatus;
  }

  const { page, limit, skip, take } = parsePagination(input);
  const orderBy = parseSort(input.sort, input.order, [
    { field: 'createdAt', defaultOrder: 'desc' },
    { field: 'title' },
    { field: 'difficulty' },
  ]);

  const [courses, total] = await Promise.all([
    courseRepo.listByOrganization(organizationId, { skip, take, status, orderBy }),
    courseRepo.countByOrganization(organizationId, status),
  ]);

  return {
    items: courses.map(toCourseListItemDto),
    meta: buildMeta(page, limit, total),
  };
}

export async function createCourse(
  organizationId: string,
  instructorUserId: string,
  rawInput: unknown,
) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const title = requireTitle(input.title);
  const slug = resolveSlug(input.slug, title);

  const category = optionalString(input.category);
  const categoryId = category
    ? await categoryService.resolveOrCreateCategoryId(organizationId, category)
    : null;

  try {
    const course = await courseRepo.createCourse({
      organizationId,
      instructorUserId,
      title,
      slug,
      description: optionalString(input.description),
      thumbnailUrl: optionalString(input.thumbnailUrl),
      categoryId,
      price: optionalMoney(input.price),
      discountPrice: optionalMoney(input.discountPrice),
      estimatedMinutes: optionalPositiveInt(input.estimatedMinutes),
      difficulty: optionalString(input.difficulty),
      learningObjectives: optionalStringList(input.learningObjectives),
      status: 'DRAFT',
      publishedAt: null,
    });
    return toCourseDto(course);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('COURSE_SLUG_TAKEN');
    }
    throw err;
  }
}

export async function updateCourseStatus(
  organizationId: string,
  courseId: string,
  rawInput: unknown,
  actor?: { userId?: string; email?: string | null; role?: string | null } | null,
) {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  if (!input.status || typeof input.status !== 'string') {
    throw new Error('MISSING_FIELDS');
  }
  const status = input.status.toUpperCase();
  if (!VALID_COURSE_STATUSES.has(status)) {
    throw new Error('INVALID_STATUS');
  }

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const publishedAt = status === 'PUBLISHED' ? (course.publishedAt ?? new Date()) : null;
  const updated = await courseRepo.updateCourseStatus(organizationId, courseId, {
    status: status as 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED',
    publishedAt,
  });
  if (!updated) {
    throw new Error('COURSE_NOT_FOUND');
  }

  if (status === 'PUBLISHED' && course.status !== 'PUBLISHED') {
    if (actor?.userId) {
      await recordAudit({
        action: 'COURSE_PUBLISHED',
        organizationId,
        actorUserId: actor.userId,
        actorEmail: actor.email ?? null,
        actorRole: actor.role ?? null,
        resourceType: 'COURSE',
        resourceId: course.id,
        metadata: {
          courseTitle: course.title,
          fromStatus: course.status,
          toStatus: status,
          publishedAt: updated.publishedAt,
        },
      });
    }
    await dispatchNotification({
      type: 'COURSE_PUBLISHED',
      title: `Course published: ${course.title}`,
      body: `Your course "${course.title}" is now published and available to students.`,
      data: {
        courseId: course.id,
        courseTitle: course.title,
        organizationName: organizationId,
      },
      userId: course.instructorUserId,
      organizationId,
      email: { courseTitle: course.title },
    });
  }

  return toCourseDto(updated);
}

export async function updateCourseThumbnail(
  organizationId: string,
  courseId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new Error('MISSING_FILE');
  }
  if (file.size > storage.MEDIA_MAX_SIZE_BYTES) {
    throw new Error('MEDIA_TOO_LARGE');
  }
  if (!storage.isAllowedThumbnailType(file.mimetype)) {
    throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  }

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const extension = storage.extensionForContentType(file.mimetype);
  if (!extension) {
    throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  }

  const key = storage.courseThumbnailKey(organizationId, courseId, extension);
  const stored = await storage.putObject({
    key,
    data: file.buffer,
    contentType: file.mimetype,
  });

  const updated = await courseRepo.updateThumbnail(organizationId, courseId, stored.publicUrl);
  if (!updated) {
    throw new Error('COURSE_NOT_FOUND');
  }
  return toCourseDto(updated);
}
