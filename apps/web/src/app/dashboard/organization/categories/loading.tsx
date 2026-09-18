import { TableSkeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 h-10 max-w-md rounded-lg bg-white" />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
