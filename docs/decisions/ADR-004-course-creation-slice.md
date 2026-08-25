# ADR-004: Course Creation Slice (Instructor / Org Admin)

**Status:** Accepted  
**Date:** 2026-08-25  
**Deciders:** Development Team  
**Technical Story:** INSTRUCTOR / ORG_ADMIN → CREATE COURSE (first course-domain slice)

## Context

LearnFlow requires that instructors and organization admins can create courses inside their own tenant (assignment brief §5 Course Management, §2 Core User Roles). Before implementation, a documentation review surfaced several gaps that the source material does not settle:

- The course status list (`DRAFT | REVIEW | PUBLISHED | ARCHIVED`) is documented, but no default status is documented.
- `docs/AUTHENTICATION.md` shows a course-creation middleware chain on `/org/:organizationId/courses`, while the implemented routers use different prefixes and one of them (`/api/v1/org`) resolves tenants without a route parameter.
- Slug uniqueness scope is undocumented (only precedent: `Organization.slug @unique`, global).
- A `Category` entity is named in the requirements (§5 field list, §15 minimum entities) but no Category model, API, or workflow exists.
- Whether course creation requires a verified email is ambiguous in the docs.
- Field types/constraints for courses are entirely undocumented.

This ADR records the ratified decisions so implementation does not rely on silent assumptions.

## Decision

### 1. Status and default

- `CourseStatus` enum: `DRAFT | REVIEW | PUBLISHED | ARCHIVED`.
- **New courses default to `DRAFT`.**
- **ASSUMPTION (explicit):** DRAFT-as-default is *not* stated anywhere in the documentation; it is adopted as a project assumption recorded here.
- The server forces `DRAFT` on creation. Any client-supplied `status` is ignored/rejected (mass-assignment protection, §16).

### 2. Route and middleware chain

```
POST /api/v1/organizations/:organizationId/courses
requireAuth
  → requireVerifiedEmail        // per Decision 8; documented "use after requireAuth"
  → requireOrganizationContext  // validates membership for :organizationId
  → requireRole('ORG_ADMIN', 'INSTRUCTOR')
```

- This preserves exactly the middleware semantics documented in `docs/AUTHENTICATION.md`.
- The existing `/api/v1/org` router MUST NOT be used for course creation: its `requireOrgAdmin` picks the first `ORG_ADMIN` membership and ignores route parameters, which is unsafe for multi-org users and incompatible with cross-tenant IDOR tests.

### 3. Tenant authority

- `organizationId` is taken from the authenticated context (`req.organizationId`, set by `requireOrganizationContext` after verifying the `UserOrganization` row), never from client-controlled input as an authority.
- Cross-tenant access returns **403** (`ORGANIZATION_ACCESS_DENIED`), consistent with existing behavior and required by assignment §4/§16.

### 4. Slug

- Per-organization uniqueness: `@@unique([organizationId, slug])`.
- Rationale: matches the shared-database + tenant_id isolation strategy (§4); prevents Org B from being blocked by Org A's title.
- Generated from the title via the existing `slugify()` convention when not supplied; conflicts map to HTTP **409**, following the Organization slug precedent (`ORGANIZATION_SLUG_TAKEN` pattern).

### 5. Instructor attribution

- `instructorId` from the client is **never accepted**.
- For an `INSTRUCTOR`, the instructor is derived server-side from the authenticated principal (`req.user.id`) after tenant validation.
- For an `ORG_ADMIN`, delegated selection is **out of scope**: until delegation is designed, an admin-created course is attributed to the admin's own membership (`instructorUserId = req.user.id`). No "create on behalf of another instructor" path exists in this slice.

### 6. Published date

- `publishedAt` is **nullable** and remains **null at creation**.
- Client-supplied values are ignored.
- Publishing (setting `PUBLISHED` + `publishedAt` atomically) is a separate future feature and is explicitly out of scope here.

### 7. Category

- For this slice, `category` is stored as a **plain string field**.
- No Category model, FK, CRUD, or workflow is created.
- **Deferred documentation debt:** Category entity/FK + management workflow must be specified later in `docs/database.md` and a dedicated decision record when that slice begins.

### 8. Email verification

- `requireVerifiedEmail` **is required** for course creation.
- **Recorded because documentation is ambiguous:** `docs/AUTHENTICATION.md` shows `requireVerifiedEmail` on a generic `/course` example but omits it from the courses middleware-chain example. The stricter reading was chosen and is recorded here as the governing decision.

### 9. Scope

This feature covers **only Create Course**. Explicitly out of scope: publishing/unpublishing, editing, deleting, listing/search endpoints, modules, lessons, quizzes, analytics, dashboard redesign, student-facing features, and Category management.

## Planned data shape (non-normative — schema not yet applied)

```prisma
enum CourseStatus {
  DRAFT
  REVIEW
  PUBLISHED
  ARCHIVED
}

model Course {
  id               String       @id @default(cuid())
  organization     Organization @relation(fields: [organizationId], references: [id])
  organizationId   String
  instructorUserId String
  title            String
  slug             String
  description      String?
  thumbnailUrl     String?
  category         String?      // deferred: becomes FK in a future slice
  price            Decimal?     @db.Decimal(10, 2)
  discountPrice    Decimal?     @db.Decimal(10, 2)
  status           CourseStatus @default(DRAFT) // ASSUMPTION: see Decision 1
  publishedAt      DateTime?
  estimatedMinutes Int?
  difficulty       String?
  learningObjectives String[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@unique([organizationId, slug])
  @@index([organizationId, status])
}
```

Field types follow existing repo conventions (cuid IDs, Prisma enums, Decimal for money, string arrays for objectives) and are marked as convention-derived, since the documentation specifies names only.

## Consequences

### Positive

- Server-side tenant authority is preserved; the endpoint reuses already-tested middleware with existing cross-tenant 403 coverage.
- All previously silent choices (default status, slug scope, email rule, category deferral) now have a written rationale.
- Small blast radius: one read-only-safe slice, no changes to existing routes or models yet.

### Negative

- `category` as a free string allows inconsistent taxonomy until the Category entity lands.
- Admin-created courses are attributed to the admin until delegated selection exists.

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Mass assignment (client sends `status`/`publishedAt`/`instructorId`) | Whitelist request fields; server derives protected values (Decision 1, 5, 6) |
| Cross-tenant IDOR | `requireOrganizationContext` + tenant-scoped queries + 403 tests (Decision 3) |
| Slug collisions | Composite unique constraint + 409 mapping (Decision 4) |
| Unverified accounts creating content | `requireVerifiedEmail` enforced (Decision 8) |

## Alternatives Considered

- **Mount under `/api/v1/org`** — rejected: parameter-less tenant resolution via first ORG_ADMIN membership breaks multi-org correctness and IDOR testability.
- **Global slug uniqueness** — rejected: couples unrelated tenants; contradicts isolation strategy.
- **Category FK now** — rejected: would silently expand scope into an undocumented CRUD workflow.
- **Client-supplied status/published date** — rejected: mass-assignment vector (§16); contradicts create-vs-publish separation (§20 integration flow).

## Open Items / Deferred Debt

1. Category entity, FK migration, management workflow (docs/database.md + future ADR).
2. Publishing workflow (`REVIEW` gate, `publishedAt` semantics).
3. Delegated instructor selection for ORG_ADMINs.
4. Fill placeholder docs affected by this feature: `docs/api.md`, `docs/database.md`, `docs/security.md`, `docs/architecture.md`; add the concrete endpoint to `docs/AUTHENTICATION.md`; extend seed data (§26).

## References

- Assignment brief (`documentation_converted.docx`): §2 Roles, §4 Multi-Tenancy, §5 Course Management, §14 API Requirements, §15 Database Design, §16 Security, §20 Testing, §26 Seed Data
- `docs/AUTHENTICATION.md` — Middleware section (course chain examples)
- `docs/decisions/ADR-003-authentication-strategy.md` — auth/session foundation this ADR builds upon
