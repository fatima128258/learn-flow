'use client';

const PURCHASE_ERRORS: Record<string, string> = {
  ORGANIZATION_REQUIRED: 'You must be part of an organization to purchase courses.',
  COURSE_NOT_FOUND: 'We could not find that course.',
  COURSE_NOT_PUBLISHED: 'This course is not available for purchase yet.',
  ALREADY_ENROLLED: 'You are already enrolled in this course.',
  ALREADY_PURCHASED: 'You have already purchased this course.',
  CHECKOUT_ALREADY_EXISTS: 'You already have a checkout in progress for this course.',
  ORDER_NOT_FOUND: 'This checkout is no longer available. Please start checkout again.',
  ORDER_NOT_PENDING: 'This order can no longer be paid.',
  PAYMENT_NOT_PENDING: 'This payment can no longer be processed.',
  PAYMENT_FAILED: 'The payment could not be processed. Please try again.',
  REQUEST_TIMEOUT: 'The purchase is taking too long. Please try again. If you were charged, check My Courses before retrying.',
  BACKEND_TIMEOUT: 'The purchase server did not respond in time. Please check My Courses before trying again.',
  PURCHASE_DATABASE_TIMEOUT: 'The purchase database is busy. Please check My Courses before trying again.',
  BACKEND_UNAVAILABLE: 'The purchase service is temporarily unavailable because the database is waking up. Please try again shortly.',
  NETWORK_ERROR: 'The purchase service could not be reached. Please check your connection and try again.',
  PROXY_ERROR: 'The purchase service is temporarily unavailable. Please try again shortly.',
  SERVER_ERROR: 'The purchase service encountered an error. Please try again shortly.',
};

export function getPurchaseErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Purchase failed. Please try again.';
  return PURCHASE_ERRORS[code] ?? 'Purchase failed. Please try again.';
}
