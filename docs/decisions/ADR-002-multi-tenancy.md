# ADR-002: Multi-Tenancy Strategy

**Status**: Accepted  
**Date**: 2026-02-01  
**Deciders**: Engineering Team  
**Affected Components**: Authentication, Authorization, Data Access, API

## Context

LearnFlow is designed as a Software-as-a-Service (SaaS) platform where multiple educational organizations use the same application infrastructure. Each organization needs:
- Isolated user bases and course catalogs
- Independent role-based access control
- Separate financial records and orders
- Isolated audit logs and compliance records
- Tenant-specific configurations

We must choose between three multi-tenancy patterns:
1. **Separate Database** - Each tenant gets its own PostgreSQL instance
2. **Separate Schemas** - One database with separate schemas per tenant
3. **Row-Level Multi-Tenancy** - Single database, single schema, tenant data isolated by row

## Decision

We implemented **Row-Level Multi-Tenancy** (shared database, shared schema) with organization-based tenant isolation.

## Rationale

### 1. **Cost Efficiency**
- Single PostgreSQL instance serves all organizations
- Reduced infrastructure costs (one database cluster, one Redis instance)
- Easier backup and disaster recovery procedures
- Simplified operational overhead

### 2. **Maintainability**
- One version of application code for all tenants
- Single schema to maintain and migrate
- Consistent data model across all organizations
- Simpler deployment and rollback procedures

### 3. **Resource Optimization**
- Database connections shared across all tenants
- Memory cache (Redis) shared efficiently via prefix keys
- Query results cached for multiple tenants
- Better resource utilization overall

### 4. **Flexibility for Growth**
- Can scale horizontally by adding more API servers
- Each server handles requests for any organization
- No pre-provisioning of infrastructure per tenant
- Easy to add new organizations at runtime

### 5. **Development Simplicity**
- Developers write code once, works for all tenants
- Easier to test multi-tenant scenarios
- No need for tenant context switching in deployment

## Implementation

### Tenant Identifier: `organizationId`

Every table either:
1. References `Organization` directly (e.g., `Course.organizationId`)
2. Inherits tenant context transitively (e.g., `Course` → `Enrollment` → `User`)

```prisma
// Direct tenant reference
model Course {
  id             String
  organizationId String  // TENANT IDENTIFIER
  instructorUserId String
  title          String
  organization   Organization @relation(fields: [organizationId], references: [id])
}

// Transitive tenant reference via User relationship
model UserOrganization {
  id             String
  userId         String
  organizationId String  // TENANT IDENTIFIER
  role           UserRole
  user           User     @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  @@unique([userId, organizationId])  // User belongs to org once
}
```

### Tenant Isolation Strategy

#### 1. **Authentication Context**
Every authenticated user has a session containing:
```typescript
interface Session {
  userId: string
  organizationId: string  // Current active organization
  role: UserRole          // Role within this organization
}
```

The user can switch organizations, but each request is scoped to one organization.

#### 2. **Request Routing**
Express middleware extracts and validates tenant context:
```typescript
// Middleware stack
app.use(sessionMiddleware);           // Load session from Redis
app.use(extractOrganizationContext);  // Get organizationId from session
app.use(validateTenantAccess);        // Verify user belongs to org
app.use(routes);                      // Execute route with tenant context
```

#### 3. **Data Access Filter**
All repository queries automatically filter by organization:
```typescript
// Service layer enforces tenant isolation
async getCourses(organizationId: string) {
  return this.prisma.course.findMany({
    where: {
      organizationId,  // Filter by tenant
      status: 'PUBLISHED'
    }
  });
}
```

#### 4. **Authorization Checks**
Role-based access control (RBAC) is organization-scoped:
```typescript
enum UserRole {
  ADMIN,        // Tenant administrator
  INSTRUCTOR,   // Can create/manage courses
  STUDENT       // Can enroll in courses
}

// Check: User is admin in THIS organization
if (user.role !== 'ADMIN' || user.organizationId !== requestOrgId) {
  throw new UnauthorizedError();
}
```

### Database Indexes for Performance

Multi-tenant queries require efficient indexing:

```sql
-- Fast tenant lookups
CREATE INDEX idx_course_orgid ON course(organization_id);
CREATE INDEX idx_course_orgid_status ON course(organization_id, status);

-- User organization lookups
CREATE INDEX idx_userorg_orgid_role ON user_organization(organization_id, role);
CREATE INDEX idx_userorg_userid ON user_organization(user_id);

-- Enrollment queries (org context)
CREATE INDEX idx_enrollment_orgid_userid ON enrollment(organization_id, user_id);
```

Prisma schema defines these:
```prisma
model Course {
  @@index([organizationId])
  @@index([organizationId, status])
}

model UserOrganization {
  @@index([organizationId])
  @@index([organizationId, role])
  @@index([organizationId, createdAt])
}
```

## Key Tables and Tenant Isolation

| Table | Tenant Field | Isolation | Notes |
|-------|--------------|-----------|-------|
| `organization` | (root) | - | One record per tenant |
| `user_organization` | `organizationId` | Direct | User's membership in org |
| `course` | `organizationId` | Direct | Org's course catalog |
| `enrollment` | Transitive via Course | Automatic | Student enrollments inherit org |
| `module` | Transitive via Course | Automatic | Course content structure |
| `lesson` | Transitive via Module | Automatic | Lesson content |
| `quiz` | Transitive via Lesson | Automatic | Assessment data |
| `payment` | Transitive via Order | Automatic | Financial records |
| `certificate` | Transitive via Course | Automatic | Student achievements |
| `audit_log` | `organizationId` | Direct | Compliance records |
| `notification` | `organizationId` | Direct | Org-scoped alerts |

## Tenant Context Flow

```
Request with Cookie (sessionId)
    ↓
Load Session from Redis
    ↓
Extract organizationId from Session
    ↓
Middleware: validateTenantAccess(userId, organizationId)
    ↓
Service: Query data WHERE organizationId = $1
    ↓
Response (only org-scoped data)
```

## Data Security Implications

### ✓ Strengths
- Data from different organizations never mixed
- Queries use WHERE clause, not application-level filtering
- Database indexes ensure fast tenant isolation
- Cascading deletes clean up org data completely

### ⚠️ Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Middleware misconfiguration allows cross-tenant access | Require explicit organizationId validation in all services |
| Query bug leaks data across tenants | Implement query audit logging |
| User switches organization, still sees old org data | Session invalidation on organization switch |
| Forgotten WHERE clause in query | Code review + query testing against multiple orgs |

## Operational Considerations

### Scaling
- Single database scales to ~500 organizations at 1000 users each
- Beyond this, consider database sharding by `organizationId` prefix
- No code changes required for customers; migration is transparent

### Backup & Recovery
- Single backup covers all organizations
- Recovery restores all tenants together (point-in-time recovery)
- Can selectively restore organization-specific data using WHERE filters

### Monitoring
- Query slowness affects all organizations
- Database resource contention shared across tenants
- Monitor per-organization query patterns to identify heavy users

### Data Export & GDPR
- Can export single organization's data easily (WHERE organizationId = $1)
- Deletion of organization cascades via foreign keys
- User deletion limited to their organization only

## Alternatives Considered

### Separate Database Per Tenant
- ✓ Complete isolation, highest security
- ✗ High infrastructure costs ($200+/month per PostgreSQL instance)
- ✗ Complex deployment (provision new DB for each signup)
- ✗ Hard to maintain schema consistency
- Not viable for 500+ organizations

### Separate Schema Per Tenant
- ✓ Better isolation than shared schema
- ✗ Schema changes require migrations on all schemas
- ✗ PostgreSQL schema switching adds latency
- ✗ Still requires per-tenant connection pooling
- Not adopted due to maintenance complexity

## Related Decisions

- **ADR-001**: Why PostgreSQL? (provides strong isolation guarantees)
- **ADR-003**: Authentication Strategy (session contains organizationId)

## Consequences

### Positive
- ✓ Cost-effective for SaaS growth
- ✓ Simple deployment and maintenance
- ✓ Fast feature development (no tenant-specific code paths)
- ✓ Efficient resource utilization
- ✓ Easy to add new organizations

### Negative
- ✗ Higher risk of data leakage from bugs
- ✗ Requires discipline in code reviews
- ✗ Database becomes single point of failure for all tenants
- ✗ Scaling horizontally requires database sharding (future complexity)
- ✗ Less complete isolation than separate databases

## Verification

To verify tenant isolation is working:
```bash
# Run as admin of Organization A
curl -H "Cookie: sessionId=A123" \
  http://localhost:3000/api/courses

# Should only return courses for Org A
# Attempting to modify Org B's course should fail with 403 Forbidden

# Check audit logs show organizationId context
SELECT * FROM audit_log 
WHERE organization_id = 'org-a' 
AND action = 'CREATE_COURSE'
```

## Future Improvements

1. **Row-Level Security (RLS)**: Implement PostgreSQL RLS policies as defense-in-depth
2. **Sharding**: Add database sharding key for organizations >1000 users
3. **Tenant Metrics**: Per-organization usage metrics and quotas
4. **Isolation Testing**: Automated tests that verify cross-tenant data is unreachable
