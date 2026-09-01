'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '../../../../../../components/ui';
import { Input } from '../../../../../../components/ui/Input';
import { SubmitButton } from '../../../../../../components/forms/SubmitButton';
import { Textarea } from '../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../components/ui/LinkButton';
import { getCreateCourseErrorMessage } from '../../../../../../features/course/createCourseErrors';
import { useToast } from '../../../../../../components/ui/ToastProvider';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    emailVerified?: boolean;
    role?: string | null;
    organizationId?: string | null;
  };
};

type CourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  price: number | string | null;
  discountPrice: number | string | null;
  estimatedMinutes: number | null;
  difficulty: string | null;
  learningObjectives: string[];
  status: string;
};

type GetCourseResponse = {
  success?: boolean;
  data?: CourseDetail;
  error?: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 50;

function joinObjectives(objectives: string[] | undefined | null): string {
  return Array.isArray(objectives) ? objectives.join('\n') : '';
}

function splitObjectives(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  return Number(value);
}

export default function EditCoursePage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const toast = useToast();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');

  const [titleError, setTitleError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [thumbnailUrlError, setThumbnailUrlError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [discountPriceError, setDiscountPriceError] = useState('');
  const [estimatedMinutesError, setEstimatedMinutesError] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function guard() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const meRes = await fetch(`${apiBase}/api/v1/auth/me`, { credentials: 'include' });
        if (!active) return;
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const meData: MeResponse = await meRes.json();
        if (!active) return;
        const role = meData.user?.role;
        if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId || !courseId) return;
    let active = true;

    async function load() {
      setLoadingCourse(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}`,
          { credentials: 'include' }
        );
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try {
            code = (await res.json())?.error;
          } catch {
            code = null;
          }
          toast.error(getCreateCourseErrorMessage(code));
          window.location.href = `/dashboard/organization/courses/${courseId}`;
          return;
        }
        const body: GetCourseResponse = await res.json();
        if (!active) return;
        if (!body.data) {
          toast.error(getCreateCourseErrorMessage('COURSE_NOT_FOUND'));
          window.location.href = `/dashboard/organization/courses/${courseId}`;
          return;
        }
        const c = body.data;
        setTitle(c.title ?? '');
        setSlug(c.slug ?? '');
        setDescription(c.description ?? '');
        setThumbnailUrl(c.thumbnailUrl ?? '');
        setCategory(c.category ?? '');
        setPrice(c.price === null || c.price === undefined ? '' : String(c.price));
        setDiscountPrice(
          c.discountPrice === null || c.discountPrice === undefined ? '' : String(c.discountPrice)
        );
        setEstimatedMinutes(c.estimatedMinutes === null ? '' : String(c.estimatedMinutes));
        setDifficulty(c.difficulty ?? '');
        setLearningObjectives(joinObjectives(c.learningObjectives));
      } catch {
        if (active) toast.error(getCreateCourseErrorMessage(null));
      } finally {
        if (active) setLoadingCourse(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, toast]);

  function clearFieldErrors() {
    setTitleError('');
    setSlugError('');
    setThumbnailUrlError('');
    setPriceError('');
    setDiscountPriceError('');
    setEstimatedMinutesError('');
  }

  function validateForm(): string | null {
    clearFieldErrors();

    if (!title.trim()) {
      setTitleError('Title is required');
      return 'Title is required';
    }

    const trimmedSlug = slug.trim();
    if (
      trimmedSlug &&
      (!SLUG_PATTERN.test(trimmedSlug) ||
        trimmedSlug.length < MIN_SLUG_LENGTH ||
        trimmedSlug.length > MAX_SLUG_LENGTH)
    ) {
      setSlugError(
        'Use lowercase letters, numbers and hyphens only (2-50 characters), e.g. intro-to-programming'
      );
      return 'Slug is invalid. Use lowercase letters, numbers and hyphens only (2-50 characters).';
    }

    const trimmedThumbnailUrl = thumbnailUrl.trim();
    if (trimmedThumbnailUrl) {
      try {
        const parsed = new URL(trimmedThumbnailUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('invalid protocol');
        }
      } catch {
        setThumbnailUrlError('Enter a valid URL starting with http:// or https://');
        return 'Enter a valid URL starting with http:// or https://';
      }
    }

    const parsedPrice = parseOptionalNumber(price);
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setPriceError('Price must be a number greater than or equal to 0');
      return 'Price must be a number greater than or equal to 0';
    }

    const parsedDiscountPrice = parseOptionalNumber(discountPrice);
    if (
      parsedDiscountPrice !== undefined &&
      (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice < 0)
    ) {
      setDiscountPriceError('Discount price must be a number greater than or equal to 0');
      return 'Discount price must be a number greater than or equal to 0';
    }

    const parsedEstimatedMinutes = parseOptionalNumber(estimatedMinutes);
    if (
      parsedEstimatedMinutes !== undefined &&
      (!Number.isInteger(parsedEstimatedMinutes) || parsedEstimatedMinutes <= 0)
    ) {
      setEstimatedMinutesError('Estimated minutes must be a whole number greater than 0');
      return 'Estimated minutes must be a whole number greater than 0';
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!organizationId || !courseId) {
      toast.error(getCreateCourseErrorMessage('ORGANIZATION_REQUIRED'));
      return;
    }

    const payload: Record<string, unknown> = {};
    payload.title = title.trim();
    payload.slug = slug.trim().toLowerCase();
    payload.description = description.trim();
    payload.thumbnailUrl = thumbnailUrl.trim();
    payload.category = category.trim();

    const parsedPrice = parseOptionalNumber(price);
    payload.price = parsedPrice ?? null;

    const parsedDiscountPrice = parseOptionalNumber(discountPrice);
    payload.discountPrice = parsedDiscountPrice ?? null;

    const parsedEstimatedMinutes = parseOptionalNumber(estimatedMinutes);
    payload.estimatedMinutes = parsedEstimatedMinutes ?? null;

    payload.difficulty = difficulty.trim();
    payload.learningObjectives = splitObjectives(learningObjectives);

    setSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 200) {
        toast.success('Course updated.');
        window.location.href = `/dashboard/organization/courses/${courseId}`;
        return;
      }

      let code: unknown = null;
      try {
        code = (await res.json())?.error;
      } catch {
        code = null;
      }
      toast.error(getCreateCourseErrorMessage(code));
    } catch {
      toast.error(getCreateCourseErrorMessage(null));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth || loadingCourse) {
    return (
      <div>
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Edit Course</p>
          <LinkButton
            href={`/dashboard/organization/courses/${courseId}`}
            variant="ghost"
            size="sm"
          >
            Back to course
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">Edit course</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Update the course details below and save your changes.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6">
            <div className="space-y-5">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={titleError}
                placeholder="e.g. Introduction to Programming"
                autoComplete="off"
                disabled={submitting}
                required
              />

              <Input
                label="Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                error={slugError}
                helperText="Lowercase letters, numbers and hyphens only."
                placeholder="e.g. introduction-to-programming"
                autoComplete="off"
                disabled={submitting}
              />

              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what students will learn"
                disabled={submitting}
              />

              <Input
                label="Thumbnail URL"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                error={thumbnailUrlError}
                placeholder="https://example.com/image.png"
                autoComplete="off"
                disabled={submitting}
              />

              <Input
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Development"
                autoComplete="off"
                disabled={submitting}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Price"
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  error={priceError}
                  placeholder="e.g. 49.99"
                  autoComplete="off"
                  disabled={submitting}
                />

                <Input
                  label="Discount price"
                  type="number"
                  min="0"
                  step="any"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  error={discountPriceError}
                  placeholder="e.g. 29.99"
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Estimated minutes"
                  type="number"
                  min="1"
                  step="1"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  error={estimatedMinutesError}
                  placeholder="e.g. 120"
                  autoComplete="off"
                  disabled={submitting}
                />

                <Input
                  label="Difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  placeholder="e.g. Beginner-friendly"
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>

              <Textarea
                label="Learning objectives"
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                rows={5}
                helperText="One objective per line."
                placeholder={'Understand variables and types\nWrite simple functions\nDebug basic programs'}
                disabled={submitting}
              />

              <SubmitButton loading={submitting} loadingText="Saving changes..." variant="primary">
                Save changes
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
