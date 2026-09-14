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

function contentUrl(courseId: string, moduleId: string, item: SequenceItem) {
  const contentPath = item.type === 'LESSON' ? 'lessons' : 'quizzes';
  return `/dashboard/student/courses/${courseId}/modules/${moduleId}/${contentPath}/${item.id}`;
}

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
  const progressBody = progressResponse.ok ? await progressResponse.json() : null;
  const modules = (progressBody?.data?.modules ?? []) as ModuleSummary[];
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
    return contentUrl(courseId, next.moduleId, next);
  }

  // Legacy modules may not have ModuleContentItem rows, so their endpoint
  // returns lessons but no `items` sequence. Resolve the next lesson directly.
  if (currentIndex < 0) {
    const currentModuleResponse = await fetch(
      `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}`,
      { credentials: 'include' },
    );
    if (currentModuleResponse.ok) {
      const currentModuleBody = await currentModuleResponse.json();
      const currentItems = Array.isArray(currentModuleBody.data?.items)
        ? currentModuleBody.data.items
        : [];
      const currentItemIndex = currentItems.findIndex(
        (item: SequenceItem) => item?.type === contentType && item.id === contentId,
      );
      const nextItem = currentItemIndex >= 0 ? currentItems[currentItemIndex + 1] : undefined;
      if (nextItem?.type && nextItem.id && nextItem.state !== 'locked' && nextItem.unlocked !== false) {
        return contentUrl(courseId, moduleId, nextItem);
      }

      const legacyLessons = Array.isArray(currentModuleBody.data?.lessons)
        ? currentModuleBody.data.lessons
        : [];
      const lessonIndex = legacyLessons.findIndex(
        (lesson: { id?: string }) => contentType === 'LESSON' && lesson.id === contentId,
      );
      const nextLesson = lessonIndex >= 0 ? legacyLessons[lessonIndex + 1] : undefined;
      if (nextLesson?.id) {
        return contentUrl(courseId, moduleId, { type: 'LESSON', id: nextLesson.id });
      }
    }
  }

  // Locked modules do not expose their content endpoint. Use the enrolled
  // course summary to find the next module's first activity instead.
  const courseResponse = await fetch(
    `/api/v1/organizations/${organizationId}/student/courses/${courseId}`,
    { credentials: 'include' },
  );
  if (!courseResponse.ok) return null;
  const courseBody = await courseResponse.json();
  const moduleSummaries = (courseBody.data?.modules ?? []) as CourseModuleSummary[];
  const orderedCourseModules = [...moduleSummaries].sort((a, b) => a.order - b.order);
  const currentModuleOrder = orderedModules.find(module => module.id === moduleId)?.order
    ?? orderedCourseModules.find(module => module.id === moduleId)?.order;
  // Skip modules that do not contain any lessons or quizzes.
  const laterModules = orderedCourseModules.filter(
    module => currentModuleOrder != null && module.order > currentModuleOrder,
  );
  for (const nextModule of laterModules) {
    const nextModuleSummary = moduleSummaries.find(module => module.id === nextModule.id);
    if (nextModuleSummary?.firstContentType && nextModuleSummary.firstContentId) {
      return contentUrl(courseId, nextModule.id, {
        type: nextModuleSummary.firstContentType,
        id: nextModuleSummary.firstContentId,
      });
    }

    const response = await fetch(
      `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${nextModule.id}`,
      { credentials: 'include' },
    );
    if (!response.ok) continue;
    const body = await response.json();
    const firstItem = Array.isArray(body.data?.items)
      ? body.data.items.find(
          (item: SequenceItem) =>
            item?.type && item?.id && item.state !== 'locked' && item.unlocked !== false,
        )
      : undefined;
    if (firstItem) {
      return contentUrl(courseId, nextModule.id, firstItem);
    }
  }

  return null;
}
