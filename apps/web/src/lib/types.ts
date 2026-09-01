export type UserRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: UserRole | null;
  organizationId: string | null;
}

export interface MeResponse {
  user: CurrentUser | null;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CourseInstructor {
  id: string;
  name: string | null;
  email: string;
}

export interface CourseOverview {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  price: number;
  discountPrice: number | null;
  category: CourseCategory | null;
  instructor: CourseInstructor;
  moduleCount: number;
  lessonCount: number;
  quizCount: number;
  isEnrolled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  courseId: string;
  title: string;
  price: number;
  discountPrice: number | null;
}

export interface Order {
  id: string;
  organizationId: string;
  studentId: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  createdAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  organizationId: string;
  status: string;
  enrolledAt: string;
  createdAt: string;
  updatedAt: string;
}

export const currency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);