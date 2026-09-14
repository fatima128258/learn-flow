type SequenceItem = {
  type: 'LESSON' | 'QUIZ';
  id: string;
  state?: 'completed' | 'current' | 'locked';
  unlocked?: boolean;
};

type ModuleSummary = {
  id: string;
  order: number;
  complete?: boolean;
};

type CourseModuleSummary = {
  id: string;
  order: number;
  firstContentType?: 'LESSON' | 'QUIZ' | null;
  firstContentId?: string | null;
};

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
  if (next && next.state !== 'locked' && next.unlocked !== false) {
    const contentPath = next.type === 'LESSON' ? 'lessons' : 'quizzes';
    return `/dashboard/student/courses/${courseId}/modules/${next.moduleId}/${contentPath}/${next.id}`;
  }

  // Locked modules do not expose their content endpoint. Use the enrolled
  // course summary to find the next module's first activity instead.
  const currentModule = orderedModules.find(module => module.id === moduleId);
  const nextModule = orderedModules.find(
    module => currentModule && module.order > currentModule.order,
  );
  if (!nextModule) return null;

  const courseResponse = await fetch(
    `/api/v1/organizations/${organizationId}/student/courses/${courseId}`,
    { credentials: 'include' },
  );
  if (!courseResponse.ok) return null;
  const courseBody = await courseResponse.json();
  const moduleSummaries = (courseBody.data?.modules ?? []) as CourseModuleSummary[];
  const nextModuleSummary = moduleSummaries.find(module => module.id === nextModule.id);
  if (!nextModuleSummary?.firstContentType || !nextModuleSummary.firstContentId) return null;

  const contentPath = nextModuleSummary.firstContentType === 'LESSON' ? 'lessons' : 'quizzes';
  return `/dashboard/student/courses/${courseId}/modules/${nextModuleSummary.id}/${contentPath}/${nextModuleSummary.firstContentId}`;
}
