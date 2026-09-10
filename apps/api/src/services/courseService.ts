import { Prisma } from '@prisma/client';
import * as courseRepo from '../repositories/courseRepository';
import * as organizationRepo from '../repositories/organizationRepository';
import * as categoryService from './categoryService';
import { categoryLabel } from '../utils/categoryLabel';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';
import * as storage from '../storage';
import { parsePagination, parseSort, buildMeta } from '../utils/pagination';
import { assertCanManage } from './contentAccess';

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
    .replace(/^-+|-+$/g, '')
    .substring(0, MAX_SLUG_LENGTH);
}

async function generateUniqueSlug(organizationId: string, baseSlug: string): Promise<string> {
  // First, try the base slug
  const existingCourse = await courseRepo.findBySlug(organizationId, baseSlug);
  if (!existingCourse) {
    return baseSlug;
  }
  
  // If base slug exists, try with numbers
  let counter = 1;
  let candidateSlug: string;
  
  do {
    candidateSlug = `${baseSlug}-${counter}`;
    // Ensure the slug doesn't exceed max length
    if (candidateSlug.length > MAX_SLUG_LENGTH) {
      // Truncate base slug to make room for the counter
      const maxBaseLength = MAX_SLUG_LENGTH - `-${counter}`.length;
      candidateSlug = `${baseSlug.substring(0, maxBaseLength)}-${counter}`;
    }
    
    const existing = await courseRepo.findBySlug(organizationId, candidateSlug);
    if (!existing) {
      return candidateSlug;
    }
    
    counter++;
    // Safety check to prevent infinite loops
  } while (counter <= 1000);
  
  // If we somehow can't find a unique slug after 1000 attempts, 
  // append timestamp as last resort
  const timestamp = Date.now().toString(36);
  candidateSlug = `${baseSlug.substring(0, MAX_SLUG_LENGTH - timestamp.length - 1)}-${timestamp}`;
  return candidateSlug;
}

async function resolveSlug(rawSlug: unknown, title: string, organizationId: string) {
  let baseSlug: string;
  
  if (typeof rawSlug === 'string' && rawSlug.trim()) {
    baseSlug = rawSlug.trim().toLowerCase();
  } else {
    baseSlug = slugify(title);
  }
  
  // Ensure the base slug is valid format
  if (!isValidSlug(baseSlug)) {
    // If still invalid, create a fallback
    baseSlug = slugify(title) || 'course';
    if (!isValidSlug(baseSlug)) {
      baseSlug = `course-${Date.now().toString(36)}`;
    }
  }
  
  // Generate a unique slug
  return await generateUniqueSlug(organizationId, baseSlug);
}

function requireTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  const title = value.trim();
  if (title.length < 2) {
    throw new Error('TITLE_TOO_SHORT');
  }
  return title;
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

interface CourseRecord {
  id: string;
  organizationId: string;
  instructorUserId: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  category: unknown;
  price: unknown;
  discountPrice: unknown;
  status: string;
  publishedAt: Date | null;
  estimatedMinutes: number | null;
  difficulty: string | null;
  learningObjectives: string[];
  createdAt: Date;
  updatedAt: Date;
}

function toCourseDto(course: CourseRecord) {
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

function toCourseListItemDto(course: {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string | null;
  price?: unknown;
  discountPrice?: unknown;
  instructorUser?: { id: string; name: string | null };
  createdAt: Date;
}) {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    status: course.status,
    difficulty: course.difficulty,
    ...(course.instructorUser
      ? {
          price: course.price,
          discountPrice: course.discountPrice,
          instructor: course.instructorUser,
        }
      : {}),
    createdAt: course.createdAt,
  };
}

export interface CourseActor {
  userId: string;
  role?: string | null;
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
  input: {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
    categoryId?: unknown;
    scope?: unknown;
    sort?: unknown;
    order?: unknown;
  } = {},
  actor?: CourseActor | null,
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

  const instructorId = actor?.role === 'INSTRUCTOR' && actor.userId ? actor.userId : undefined;
  const creatorRole = actor?.role === 'ORG_ADMIN' && input.scope === 'organization'
    ? 'ORG_ADMIN' as const
    : undefined;
  const categoryId =
    input.categoryId !== undefined && input.categoryId !== null && input.categoryId !== ''
      ? String(input.categoryId)
      : undefined;
  const listOptions = {
    skip,
    take,
    status,
    orderBy,
    instructorId,
    ...(categoryId ? { categoryId } : {}),
    ...(categoryId ? { includeDetails: true } : {}),
    ...(creatorRole ? { creatorRole } : {}),
  };

  const [courses, total] = await Promise.all([
    courseRepo.listByOrganization(organizationId, listOptions),
    categoryId
      ? courseRepo.countByOrganization(organizationId, status, instructorId, categoryId, creatorRole)
      : courseRepo.countByOrganization(organizationId, status, instructorId, undefined, creatorRole),
  ]);

  return {
    items: courses.map(toCourseListItemDto),
    meta: buildMeta(page, limit, total),
  };
}

export async function getInstructorDashboard(organizationId: string, instructorUserId: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const result = await courseRepo.getInstructorDashboard(organizationId, instructorUserId, start, end);

  const trendByDate = new Map(result.enrollmentTrend.map((point) => [point.date, point.count]));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const trend = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), index + 1));
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: trendByDate.get(key) ?? 0 };
  });

  return { ...result, trend };
}

export async function createCourse(
  organizationId: string,
  instructorUserId: string,
  rawInput: unknown,
  actorRole?: string | null,
) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const title = requireTitle(input.title);
  const slug = await resolveSlug(input.slug, title, organizationId);

  const requestedCategoryId = optionalString(input.categoryId);
  const categoryId = requestedCategoryId
    ? await categoryService.assertAssignableCategory(organizationId, requestedCategoryId, { id: instructorUserId, role: actorRole ?? undefined })
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

function requireMoney(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(field === 'discountPrice' ? 'INVALID_DISCOUNT_PRICE' : 'INVALID_PRICE');
  }
  return parsed;
}

export async function updateCourse(
  organizationId: string,
  courseId: string,
  rawInput: unknown,
  actor?: CourseActor | null,
) {
  const existing = await courseRepo.getById(organizationId, courseId);
  if (!existing) {
    throw new Error('COURSE_NOT_FOUND');
  }
  assertCanManage(actor, existing);

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const hasAnyField = [
    'title', 'slug', 'description', 'thumbnailUrl', 'category', 'categoryId', 'price',
    'discountPrice', 'estimatedMinutes', 'difficulty', 'learningObjectives',
    'instructorUserId',
  ].some((key) => input[key] !== undefined);

  if (!hasAnyField) {
    throw new Error('MISSING_FIELDS');
  }

  const update: courseRepo.UpdateCourseData = {};

  if (input.title !== undefined) {
    update.title = requireTitle(input.title);
  }

  if (input.slug !== undefined && input.slug !== '' && input.slug !== null) {
    const slug = String(input.slug).trim().toLowerCase();
    if (!isValidSlug(slug)) {
      throw new Error('INVALID_SLUG');
    }
    // Check if slug is available (not taken by another course)
    const existingCourse = await courseRepo.findBySlug(organizationId, slug);
    if (existingCourse && existingCourse.id !== courseId) {
      throw new Error('COURSE_SLUG_TAKEN');
    }
    update.slug = slug;
  }

  if (input.description !== undefined) {
    update.description = optionalString(input.description);
  }

  if (input.thumbnailUrl !== undefined) {
    update.thumbnailUrl = optionalString(input.thumbnailUrl);
  }

  if (input.categoryId !== undefined) {
    const requestedCategoryId = optionalString(input.categoryId);
    update.categoryId = requestedCategoryId
      ? await categoryService.assertAssignableCategory(organizationId, requestedCategoryId, actor ? { id: actor.userId, role: actor.role ?? undefined } : undefined)
      : null;
  }

  if (input.price !== undefined) {
    update.price = requireMoney(input.price, 'price');
  }

  if (input.discountPrice !== undefined) {
    update.discountPrice = requireMoney(input.discountPrice, 'discountPrice');
  }

  if (input.estimatedMinutes !== undefined) {
    update.estimatedMinutes = optionalPositiveInt(input.estimatedMinutes);
  }

  if (input.difficulty !== undefined) {
    update.difficulty = optionalString(input.difficulty);
  }

  if (input.learningObjectives !== undefined) {
    update.learningObjectives =
      input.learningObjectives === null ? [] : optionalStringList(input.learningObjectives);
  }

  if (input.instructorUserId !== undefined) {
    const isStaff = (actor?.role === 'ORG_ADMIN' || actor?.role === 'PLATFORM_ADMIN');
    if (!isStaff) {
      throw new Error('FORBIDDEN');
    }
    if (typeof input.instructorUserId !== 'string' || !input.instructorUserId.trim()) {
      throw new Error('MISSING_FIELDS');
    }
    const instructorUserId = input.instructorUserId.trim();
    // A User ID is global, so it is not sufficient to trust it just because
    // the caller is an organization administrator. The replacement owner must
    // be a staff member of this same tenant.
    const membership = await organizationRepo.findMembership(
      instructorUserId,
      organizationId,
    );
    if (!membership || !['INSTRUCTOR', 'ORG_ADMIN'].includes(membership.role)) {
      throw new Error('INVALID_INSTRUCTOR');
    }
    update.instructorUserId = instructorUserId;
  }

  let course;
  try {
    course = await courseRepo.updateCourse(organizationId, courseId, update);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('COURSE_SLUG_TAKEN');
    }
    throw err;
  }
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  return toCourseDto(course);
}

export async function updateCourseStatus(
  organizationId: string,
  courseId: string,
  rawInput: unknown,
  actor?: { userId?: string; name?: string | null; email?: string | null; role?: string | null } | null,
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

  assertCanManage(actor, course);

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
        actorName: actor.name ?? null,
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
  actor?: CourseActor | null,
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
  if (storage.hasUnsafeExtension(file.originalname)) {
    throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  }

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  assertCanManage(actor, course);

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
