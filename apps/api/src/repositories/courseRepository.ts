import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateCourseData {
  organizationId: string;
  instructorUserId: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  category?: string | null;
  price?: number | null;
  discountPrice?: number | null;
  estimatedMinutes?: number | null;
  difficulty?: string | null;
  learningObjectives?: string[];
  status: 'DRAFT';
  publishedAt: null;
}

export async function createCourse(data: CreateCourseData) {
  return prisma().course.create({
    data: {
      organizationId: data.organizationId,
      instructorUserId: data.instructorUserId,
      title: data.title,
      slug: data.slug,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      category: data.category,
      price: data.price,
      discountPrice: data.discountPrice,
      status: data.status,
      publishedAt: data.publishedAt,
      estimatedMinutes: data.estimatedMinutes,
      difficulty: data.difficulty,
      learningObjectives: data.learningObjectives,
    },
  });
}
