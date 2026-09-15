'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ApiError, deleteJson, getJson, patchJson, postJson } from '@/lib/api';
import { Button, ConfirmModal, Drawer, Input, Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
type TaskForm = { title: string; description: string; status: TaskStatus; dueDate: string; priority: Priority };
const emptyForm: TaskForm = { title: '', description: '', status: 'PENDING', dueDate: '', priority: 'MEDIUM' };
const columns: Array<{ status: TaskStatus; title: string; empty: string; color: string }> = [
  { status: 'PENDING', title: 'Pending', empty: 'No pending tasks', color: 'border-amber-200' },
  { status: 'IN_PROGRESS', title: 'In Progress', empty: 'No tasks in progress', color: 'border-blue-200' },
  { status: 'COMPLETED', title: 'Completed', empty: 'No completed tasks', color: 'border-emerald-200' },
];

const taskError = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'The task could not be saved. Please try again.';
  if (error.code === 'INVALID_TASK') return 'Please provide a title and valid task details.';
  if (error.code === 'TASK_STORAGE_UNAVAILABLE' || error.status === 404) {
    return 'Tasks are temporarily unavailable. Please try again after the server is updated.';
  }
  return 'The task could not be saved. Please try again.';
};

export default function TaskBoard() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const moveVersions = useRef(new Map<string, number>());

  useEffect(() => {
    getJson<{ data: Task[] }>('/api/v1/student/tasks')
      .then((response) => setTasks(response.data))
      .catch(() => toast.error('Unable to load your tasks.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const grouped = useMemo(() => columns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.status),
  })), [tasks]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      priority: task.priority,
    });
    setFormOpen(true);
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), description: form.description.trim() || null, dueDate: form.dueDate || null };
      if (editing) {
        const response = await patchJson<{ data: Task }>(`/api/v1/student/tasks/${editing.id}`, payload);
        setTasks((current) => current.map((task) => task.id === editing.id ? response.data : task));
        toast.success('Task updated.');
      } else {
        const response = await postJson<{ data: Task }>('/api/v1/student/tasks', payload);
        setTasks((current) => [response.data, ...current]);
        toast.success('Task created.');
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(taskError(error));
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(id: string, status: TaskStatus) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;

    const version = (moveVersions.current.get(id) ?? 0) + 1;
    moveVersions.current.set(id, version);
    const previousTask = task;
    setMovingTaskId(id);
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status, completedAt: status === 'COMPLETED' ? new Date().toISOString() : null } : item));

    try {
      const response = await patchJson<{ data: Task }>(`/api/v1/student/tasks/${id}`, { status });
      if (moveVersions.current.get(id) === version) {
        setTasks((current) => current.map((item) => item.id === id ? response.data : item));
      }
    } catch {
      if (moveVersions.current.get(id) === version) {
        setTasks((current) => current.map((item) => item.id === id ? previousTask : item));
        toast.error('Task status could not be updated.');
      }
    } finally {
      if (moveVersions.current.get(id) === version) {
        setMovingTaskId(null);
      }
    }
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const id = draggedId;
    setDraggedId(null);
    if (id) void moveTask(id, status);
  }

  async function removeTask() {
    if (!deleting) return;
    const id = deleting.id;
    try {
      await deleteJson(`/api/v1/student/tasks/${id}`);
      setTasks((current) => current.filter((task) => task.id !== id));
      setDeleting(null);
      toast.success('Task deleted.');
    } catch {
      toast.error('Task could not be deleted.');
    }
  }

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size="lg" label="Loading tasks..." /></div>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-neutral-900">My Tasks</h1><p className="mt-1 text-sm text-neutral-500">Organize your learning goals and stay on track.</p></div>
        <Button onClick={openCreate}> Add Task</Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {grouped.map((column) => (
          <section key={column.status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, column.status)} className={`min-h-[18rem] rounded-2xl border-2 ${column.color} bg-[#fffdf9] p-4`}>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-neutral-900">{column.title}</h2><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">{column.tasks.length}</span></div>
            <div className="space-y-3">
              {column.tasks.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">{column.empty}</p> : column.tasks.map((task) => (
                <article
                  key={task.id}
                  draggable={movingTaskId !== task.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggedId(task.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${task.status === 'COMPLETED' ? 'opacity-75' : ''} ${movingTaskId === task.id ? 'cursor-wait opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  <div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-neutral-900">{task.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : task.priority === 'LOW' ? 'bg-neutral-100 text-neutral-600' : 'bg-amber-100 text-amber-700'}`}>{task.priority}</span></div>
                  {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{task.description}</p>}
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-neutral-500"><span>{task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}</span><div className="flex gap-2"><button type="button" onClick={() => openEdit(task)} className="font-medium text-primary-700 hover:underline">Edit</button><button type="button" onClick={() => setDeleting(task)} className="font-medium text-red-600 hover:underline">Delete</button></div></div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Drawer isOpen={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={editing ? 'Edit Task' : 'Add Task'}>
        <form id="task-form" onSubmit={saveTask} className="flex min-h-full flex-col gap-4">
          <Input label="Title" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={200} />
          <div><label htmlFor="task-description" className="mb-1.5 block text-sm font-medium text-neutral-700">Description</label><textarea id="task-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={5000} rows={4} className="w-full rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-4 py-3 text-sm outline-none focus:border-[#7a4a2e]" /></div>
          <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-neutral-700">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))} className="mt-1.5 w-full rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-3 py-3 text-sm"><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select></label><label className="text-sm font-medium text-neutral-700">Priority<select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))} className="mt-1.5 w-full rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-3 py-3 text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
          <div className="mt-auto flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Task'}</Button>
          </div>
        </form>
      </Drawer>
      <ConfirmModal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void removeTask()} title="Delete task?" message="This task will be permanently deleted." confirmLabel="Delete" variant="danger" />
    </div>
  );
}
