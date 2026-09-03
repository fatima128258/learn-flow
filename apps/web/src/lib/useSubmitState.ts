import { useCallback, useRef, useState } from 'react';

export interface UseSubmitStateResult {
  /** Whether an async action is currently pending. */
  isSubmitting: boolean;
  /** Human-readable error captured from the last failed action. */
  error: string | null;
  /** Whether the last action resolved successfully. */
  isSuccess: boolean;
  /** Manually set/capture an error outside of `submit` (e.g. validation of query params). */
  setError: (message: string | null) => void;
  /**
   * Runs an async action exactly once. Concurrent calls while a previous
   * action is still pending are ignored (returns `false`). Loading stays true
   * until the real promise settles, then error/success is captured.
   */
  submit: (action: () => Promise<unknown>) => Promise<boolean>;
}

/**
 * Shared state for any async submit-style action: idle → loading → success/error.
 * Guards against duplicate submissions and keeps the loading state tied to the
 * actual promise rather than a fake delay.
 */
export function useSubmitState(): UseSubmitStateResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const busy = useRef(false);

  const submit = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);
    try {
      await action();
      setIsSuccess(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, error, isSuccess, setError, submit };
}
