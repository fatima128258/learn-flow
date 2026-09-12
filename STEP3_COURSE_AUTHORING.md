# Step 3 Course Authoring / Course Builder

The authoring surface is organization-scoped and supports:

- course creation and metadata updates;
- module and lesson CRUD;
- quiz, question, and option CRUD, including question marks and correct
  options;
- persisted mixed lesson/quiz module ordering through `ModuleContentItem`;
- draft → review → published lifecycle (with archive/unarchive paths);
- tenant and course-owner authorization for instructor mutations, while
  organization/platform administrators can manage tenant courses.

Lesson preview state is now preserved from create and update requests
(`isPreview` defaults to `false` on create and remains unchanged on unrelated
updates). Status changes are constrained to the supported authoring lifecycle;
invalid transitions return `INVALID_STATUS`.

Step 2 sequential access remains intact: this document describes authoring
only and does not alter student gating, attempts, scoring, completion, or
certificates.
