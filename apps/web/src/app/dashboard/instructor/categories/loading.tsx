import { TableSkeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="h-10 max-w-md flex-1 rounded-lg bg-white" />
        <div className="h-10 w-36 rounded-lg bg-white" />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
