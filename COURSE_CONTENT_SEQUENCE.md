# Mixed course content sequence

Each module has a persisted `ModuleContentItem` sequence containing lessons and quizzes. The migration backfills existing rows in their existing per-type order (lessons precede quizzes on ties), and newly created content is appended. Deleting a lesson or quiz removes its sequence row through cascading relationships.

Instructors and organization administrators can view and replace a module's sequence with:

`GET/PUT /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/content`

The PUT body is `{ "items": [{ "type": "LESSON" | "QUIZ", "id": "..." }] }`. The API validates the tenant, course/module ownership, role, exact membership, and duplicate-free input. Student module responses retain the existing `lessons` field and add explicitly typed ordered `items`; the student UI renders those items in order without locking or attempt restrictions.
