# Student sequential access

Student lesson and quiz access is ordered by the persisted `ModuleContentItem.position`
sequence. An authenticated, verified student must have an active enrollment in the
tenant course. The first incomplete item is `current`; later items are `locked` until
every preceding item is complete. Lesson completion uses the existing lesson progress
record. A quiz is complete only when an existing quiz attempt is marked `passed`.

The module lesson response retains `lessons` and `items`, adding `state` to ordered
items (`completed`, `current`, or `locked`). Direct lesson and quiz reads and quiz
submissions enforce the same rule and return `CONTENT_LOCKED` (403).

Quiz completion intentionally relies on the current attempt records; this change does
not add scoring, timers, attempt policies, or a new completion model. The migration
backfills existing courses and newly-created content is appended. If a sequence is
missing or corrupt, direct content access is denied with `CONTENT_SEQUENCE_MISSING`;
there is no legacy bypass.
