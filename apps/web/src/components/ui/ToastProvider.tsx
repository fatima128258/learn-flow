'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Toast, ToastVariant } from './Toast';

export interface ToastInput {
  variant?: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { ...input, id }]);
      const duration = input.duration ?? 5000;
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, title?: string) => toast({ variant: 'success', message, title }),
    [toast],
  );
  const error = useCallback(
    (message: string, title?: string) => toast({ variant: 'error', message, title }),
    [toast],
  );
  const info = useCallback(
    (message: string, title?: string) => toast({ variant: 'info', message, title }),
    [toast],
  );
  const warning = useCallback(
    (message: string, title?: string) => toast({ variant: 'warning', message, title }),
    [toast],
  );

  const value = useMemo(
    () => ({ toast, success, error, warning, info }),
    [toast, success, error, warning, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            title={t.title}
            message={t.message}
            duration={0}
            onClose={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

ToastProvider.displayName = 'ToastProvider';
