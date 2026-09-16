'use client';

import { useEffect, useState } from 'react';
import { EmptyState, EmptyStateIcons, ErrorState, Select, Spinner, ViewToggle } from '@/components/ui';
import { TableCard, ProgressBar, tableCellClass, tableHeadClass, tableRowHoverClass } from '@/components/dashboard';

type StudentProgressItem = {
  enrollmentId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  courseId: string;
  courseName: string;
  progress: number;
  courseCompleted: boolean;
  certificateEligible: boolean;
  enrollmentDate: string;
  lastVisited: { lessonId: string | null; moduleId: string | null; lastVisitedAt: string | null } | null;
  modules: Array<{ id: string; title: string; percentage: number; complete: boolean; requiredItemCount: number; completedItemCount: number }>;
  quizzes: Array<{ quizId: string; attempted: boolean; passed: boolean; failed: boolean; attemptsUsed: number; attemptsRemaining: number | null }>;
};

type Props = { apiPath: string };

export function StudentProgressView({ apiPath }: Props) {
  const [items, setItems] = useState<StudentProgressItem[]>([]);
  const [query, setQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState('ALL');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [selected, setSelected] = useState<StudentProgressItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (query.trim()) params.set('search', query.trim());
        if (progressFilter !== 'ALL') params.set('progressStatus', progressFilter);
        const response = await fetch(`${apiPath}?${params}`, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load student progress');
        const body = await response.json();
        if (!active) return;
        setItems(body.data ?? []);
        setMeta({ total: body.meta?.total ?? 0, totalPages: body.meta?.totalPages ?? 0 });
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [apiPath, page, query, progressFilter, retryKey]);

  function ProgressCell({ item }: { item: StudentProgressItem }) {
    return (
      <div className="min-w-32">
        <div className="mb-1 text-sm font-semibold text-neutral-800">{item.progress}%</div>
        <ProgressBar value={item.progress} />
      </div>
    );
  }

  async function openDetails(item: StudentProgressItem) {
    setSelected(item);
    setDetailLoading(true);
    try {
      const response = await fetch(`${apiPath}/${item.studentId}/${item.courseId}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unable to load student progress details');
      const body = await response.json();
      setSelected(body.data ?? item);
    } catch {
      setSelected(item);
    } finally {
      setDetailLoading(false);
    }
  }

  if (error) {
    return <ErrorState title="Unable to load student progress" message="The server may be waking up. Please try again." action={{ label: 'Retry', onClick: () => setRetryKey((value) => value + 1) }} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Student Progress</h1>
        </div>
        <ViewToggle value={view} onChange={(value) => setView(value as 'table' | 'cards')} storageKey={`student-progress-${apiPath}`} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => { setPage(1); setQuery(event.target.value); }}
          placeholder="Search students or courses..."
          aria-label="Search students or courses"
          className="min-w-0 flex-1 rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-4 py-3 text-sm outline-none focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20"
        />
        <Select value={progressFilter} onChange={(value) => { setPage(1); setProgressFilter(value); }} options={[{ value: 'ALL', label: 'All progress' }, { value: 'NOT_STARTED', label: 'Not started' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }]} />
      </div>
      {loading ? (
        <div className="flex items-center gap-3 text-neutral-700"><Spinner size="md" label="Loading student progress..." /><span>Loading student progress...</span></div>
      ) : items.length === 0 ? (
        <TableCard><EmptyState icon={EmptyStateIcons.NoCourses} title={query ? 'No students found' : 'No students enrolled yet'} description={query ? 'Try a different student or course name.' : 'Students enrolled in your courses will appear here.'} /></TableCard>
      ) : view === 'table' ? (
        <TableCard>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50"><tr><th className={tableHeadClass}>Student</th><th className={tableHeadClass}>Enrolled Course</th><th className={tableHeadClass}>Progress</th><th className={tableHeadClass}>Enrollment Date</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item) => (
                  <tr key={item.enrollmentId} className={`${tableRowHoverClass} cursor-pointer`} onClick={() => { void openDetails(item); }}>
                    <td className={tableCellClass}><div className="font-medium text-neutral-900">{item.studentName || 'Unnamed student'}</div></td>
                    <td className={tableCellClass}>{item.courseName}</td>
                    <td className={tableCellClass}><ProgressCell item={item} /></td>
                    <td className={tableCellClass}>{new Date(item.enrollmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <button key={item.enrollmentId} type="button" onClick={() => { void openDetails(item); }} className="rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 text-left shadow-sm hover:shadow-md"><div className="font-semibold text-[#5a321f]">{item.studentName || 'Unnamed student'}</div><div className="mt-1 text-sm text-neutral-600">{item.courseName}</div><div className="mt-4"><ProgressCell item={item} /></div><div className="mt-4 text-xs text-neutral-500">Enrolled {new Date(item.enrollmentDate).toLocaleDateString()}</div></button>)}
        </div>
      )}
      {meta.totalPages > 1 && <div className="flex items-center justify-between text-sm text-neutral-600"><span>{meta.total} enrollments</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span className="px-2 py-2">{page} / {meta.totalPages}</span><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></div>}
      {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setSelected(null)} className="float-right text-2xl text-neutral-400" aria-label="Close">x</button><h2 className="text-xl font-semibold text-neutral-900">{selected.studentName || 'Unnamed student'}</h2><p className="mt-1 text-sm text-neutral-500">{selected.studentEmail}</p><h3 className="mt-6 font-semibold">{selected.courseName}</h3><ProgressCell item={selected} />{detailLoading ? <div className="mt-6"><Spinner size="md" label="Loading progress details..." /></div> : <><div className="mt-6 space-y-3"><h3 className="font-semibold">Module progress</h3>{selected.modules.map((module) => <div key={module.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"><span>{module.title}</span><span className="font-medium">{module.percentage}% {module.complete ? '✓' : ''}</span></div>)}</div><div className="mt-6 space-y-2"><h3 className="font-semibold">Quiz status</h3>{selected.quizzes.map((quiz) => <div key={quiz.quizId} className="flex justify-between text-sm"><span>{quiz.attempted ? (quiz.passed ? 'Passed' : 'Failed') : 'Not attempted'}</span><span>{quiz.attemptsUsed} used, {quiz.attemptsRemaining ?? 'unlimited'} remaining</span></div>)}</div></>}</aside></div>}
    </div>
  );
}
