import { Spinner } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading dashboard">
      <Spinner size="md" label="Loading..." />
    </div>
  );
}
