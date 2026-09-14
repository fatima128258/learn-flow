type SequenceItem = {
  type: 'LESSON' | 'QUIZ';
  id: string;
  state?: 'completed' | 'current' | 'locked';
  unlocked?: boolean;
};

type ModuleSummary = { id: string; order: number };

export async function getNextContentUrl({
  organizationId,
  courseId,
  moduleId,
  contentType,
  contentId,
}: {
  organizationId: string;
  courseId: string;
  moduleId: string;
  contentType: 'LESSON' | 'QUIZ';
  contentId: string;
}): Promise<string | null> {
  const progressResponse = await fetch(
    `/api/v1/organizations/${organizationId}/student/courses/${courseId}/progress`,
    { credentials: 'include' },
  );
  if (!progressResponse.ok) return null;

  const progressBody = await progressResponse.json();
  const modules = (progressBody.data?.modules ?? []) as ModuleSummary[];
  const orderedModules = [...modules].sort((a, b) => a.order - b.order);
  const sequence: Array<SequenceItem & { moduleId: string }> = [];

  for (const module of orderedModules) {
    const response = await fetch(
      `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${module.id}`,
      { credentials: 'include' },
    );
    if (!response.ok) continue;
    const body = await response.json();
    const items = Array.isArray(body.data?.items) ? body.data.items : [];
    for (const item of items) {
      if (item?.type && item?.id) {
        sequence.push({ type: item.type, id: item.id, state: item.state, unlocked: item.unlocked, moduleId: module.id });
      }
    }
  }

  const currentIndex = sequence.findIndex(
    (item) => item.moduleId === moduleId && item.type === contentType && item.id === contentId,
  );
  const next = currentIndex >= 0 ? sequence[currentIndex + 1] : undefined;
  if (!next || next.state === 'locked' || next.unlocked === false) return null;

  const contentPath = next.type === 'LESSON' ? 'lessons' : 'quizzes';
  return `/dashboard/student/courses/${courseId}/modules/${next.moduleId}/${contentPath}/${next.id}`;
}
