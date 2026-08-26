'use client';

import { useEffect, useState } from 'react';
import { Alert, Spinner } from '../../../../../components/ui';
import { FormError } from '../../../../../components/forms/FormError';
import { Input } from '../../../../../components/ui/Input';
import { SubmitButton } from '../../../../../components/forms/SubmitButton';
import { Textarea } from '../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../components/ui/LinkButton';
import { getCreateCourseErrorMessage } from '../../../../../features/course/createCourseErrors';

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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 50;

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

export default function CreateCoursePage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
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

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  function resetForm() {
    setTitle('');
    setSlug('');
    setDescription('');
    setThumbnailUrl('');
    setCategory('');
    setPrice('');
    setDiscountPrice('');
    setEstimatedMinutes('');
    setDifficulty('');
    setLearningObjectives('');
  }

  function clearFieldErrors() {
    setTitleError('');
    setSlugError('');
    setThumbnailUrlError('');
    setPriceError('');
    setDiscountPriceError('');
    setEstimatedMinutesError('');
  }

  function validateForm(): boolean {
    clearFieldErrors();
    let isValid = true;

    if (!title.trim()) {
      setTitleError('Title is required');
      isValid = false;
    }

    const trimmedSlug = slug.trim();
    if (trimmedSlug) {
      if (
        !SLUG_PATTERN.test(trimmedSlug) ||
        trimmedSlug.length < MIN_SLUG_LENGTH ||
        trimmedSlug.length > MAX_SLUG_LENGTH
      ) {
        setSlugError(
          'Use lowercase letters, numbers and hyphens only (2-50 characters), e.g. intro-to-programming'
        );
        isValid = false;
      }
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
        isValid = false;
      }
    }

    const parsedPrice = parseOptionalNumber(price);
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setPriceError('Price must be a number greater than or equal to 0');
      isValid = false;
    }

    const parsedDiscountPrice = parseOptionalNumber(discountPrice);
    if (
      parsedDiscountPrice !== undefined &&
      (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice < 0)
    ) {
      setDiscountPriceError('Discount price must be a number greater than or equal to 0');
      isValid = false;
    }

    const parsedEstimatedMinutes = parseOptionalNumber(estimatedMinutes);
    if (
      parsedEstimatedMinutes !== undefined &&
      (!Number.isInteger(parsedEstimatedMinutes) || parsedEstimatedMinutes <= 0)
    ) {
      setEstimatedMinutesError('Estimated minutes must be a whole number greater than 0');
      isValid = false;
    }

    return isValid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    if (!organizationId) {
      setFormError(getCreateCourseErrorMessage('ORGANIZATION_REQUIRED'));
      return;
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
    };

    if (slug.trim()) payload.slug = slug.trim().toLowerCase();
    if (description.trim()) payload.description = description.trim();
    if (thumbnailUrl.trim()) payload.thumbnailUrl = thumbnailUrl.trim();
    if (category.trim()) payload.category = category.trim();

    const parsedPrice = parseOptionalNumber(price);
    if (parsedPrice !== undefined) payload.price = parsedPrice;

    const parsedDiscountPrice = parseOptionalNumber(discountPrice);
    if (parsedDiscountPrice !== undefined) payload.discountPrice = parsedDiscountPrice;

    const parsedEstimatedMinutes = parseOptionalNumber(estimatedMinutes);
    if (parsedEstimatedMinutes !== undefined) payload.estimatedMinutes = parsedEstimatedMinutes;

    if (difficulty.trim()) payload.difficulty = difficulty.trim();

    payload.learningObjectives = splitObjectives(learningObjectives);

    setSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 201) {
        setSuccessMessage('Course created as a draft.');
        resetForm();
        return;
      }

      let code: unknown = null;
      try {
        code = (await res.json())?.error;
      } catch {
        code = null;
      }
      setFormError(getCreateCourseErrorMessage(code));
    } catch {
      setFormError(getCreateCourseErrorMessage(null));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Create Course</p>
          <LinkButton href="/dashboard/organization" variant="ghost" size="sm">
            Back to dashboard
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">New course</h1>
          <p className="mt-1 text-sm text-neutral-500">
            New courses are created as drafts. Publishing is handled separately.
          </p>

          {successMessage ? (
            <div className="mt-6">
              <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
                {successMessage}
              </Alert>
            </div>
          ) : null}

          {formError ? (
            <div className="mt-6">
              <FormError message={formError} />
            </div>
          ) : null}

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
                helperText="Optional. Generated from the title if left empty."
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

              <SubmitButton loading={submitting} loadingText="Creating course...">
                Create course
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
