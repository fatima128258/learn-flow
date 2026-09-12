# Step 3 Course Authoring Audit

## Scope and baseline

This audit records the repository state before the Step 3 changes. Step 2's
sequential-access implementation and `docs/database.md` are intentionally
unchanged.

## Existing implementation

- `Course` already has tenant and instructor ownership fields, pricing and
  metadata, and `DRAFT`, `REVIEW`, `PUBLISHED`, and `ARCHIVED` statuses.
- Course create/update/status endpoints are mounted under the organization
  API and use authentication, verified-email, organization-context, and
  instructor/org-admin role middleware.
- Modules, lessons, quizzes, questions, and options each have repository,
  service, controller, and route layers with create/read/update/delete APIs.
- Parent IDs are checked at each service boundary (organization → course →
  module → quiz → question → option); mutating services also call
  `assertCanManage`.
- `ModuleContentItem` persists a mixed lesson/quiz order. Lesson and quiz
  creation appends an item, deletion cascades/removes it, and the sequence
  replacement endpoint validates membership and duplicates.
- Existing instructor and organization course-builder pages and focused API
  tests cover the main creation and publishing journey.

## Findings requiring implementation

1. Lesson creation discarded the request's `isPreview` value and always wrote
   `true`; updates also forced it to `true`. This made non-preview lessons
   public previews and contradicted the existing builder contract/tests.
2. Course status handling validated enum values but did not enforce lifecycle
   transitions. A course could jump directly between any statuses, including
   publishing an archived course or returning a published course to draft.

## Step 3 implementation boundary

The changes below fix those authoring defects and add focused regression
coverage/documentation only. Authentication, Redis, quiz attempts/timers/max
attempt behavior, scoring, completion, certificates, and unrelated features
are not redesigned.
