'use client';

const PURCHASE_ERRORS: Record<string, string> = {
  ORGANIZATION_REQUIRED: 'You must be part of an organization to purchase courses.',
  COURSE_NOT_FOUND: 'We could not find that course.',
  COURSE_NOT_PUBLISHED: 'This course is not available for purchase yet.',
  ALREADY_ENROLLED: 'You are already enrolled in this course.',
  ALREADY_PURCHASED: 'You have already purchased this course.',
  PAYMENT_FAILED: 'The payment could not be processed. Please try again.',
};

export function getPurchaseErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Purchase failed. Please try again.';
  return PURCHASE_ERRORS[code] ?? 'Purchase failed. Please try again.';
}