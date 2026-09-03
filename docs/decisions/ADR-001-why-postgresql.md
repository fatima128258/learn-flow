# ADR-001: Why PostgreSQL?

**Status**: Accepted  
**Date**: 2026-02-01  
**Deciders**: Engineering Team  
**Affected Components**: Data Layer, Persistence, Analytics

## Context

LearnFlow is a multi-tenant learning management system that requires:
- Reliable, consistent storage for course content, user progress, and financial transactions
- Complex relational queries across users, courses, enrollments, and organizations
- Row-level security (RLS) for multi-tenant data isolation
- Advanced data types (arrays, JSON, enums) for flexible schema evolution
- ACID transaction support for critical operations (payments, enrollment, certificate generation)
- High query performance for reporting and analytics
- Strong data integrity with foreign key constraints
- JSON support for storing flexible metadata

## Decision

We chose **PostgreSQL 15+** as the primary relational database for LearnFlow.

## Rationale

### 1. **Relational Integrity**
PostgreSQL's strong foreign key support and ACID compliance ensure data consistency across:
- User → Organization relationships
- Course → Module → Lesson hierarchies
- Enrollment → Payment transactions
- Progress tracking with lesson/quiz attempts

### 2. **Multi-Tenant Isolation**
PostgreSQL provides multiple strategies for tenant isolation:
- Row-based isolation via `organizationId` foreign keys
- Row-Level Security (RLS) policies for enforcing tenant boundaries
- Efficient indexing on tenant identifiers for query performance

### 3. **Complex Queries**
LearnFlow requires sophisticated queries:
- Course progress calculations across modules and lessons
- Enrollment reporting with course and user joins
- Quiz attempt scoring with question-level logic
- Audit log searches with timestamp and actor filtering

PostgreSQL's join optimization and query planner make these operations efficient.

### 4. **Advanced Data Types**
PostgreSQL supports flexible schema patterns needed for:
- **Arrays**: `learningObjectives TEXT[]` for course goals
- **JSON**: Flexible metadata storage for course content types
- **Enums**: Type-safe status fields (`CourseStatus`, `UserRole`, `OrganizationStatus`)
- **UUIDs**: `CUID()` primary keys for distributed systems

### 5. **ACID Transactions**
Critical operations require guarantees:
- Payment processing must be all-or-nothing (no partial orders)
- Certificate generation must be atomic with enrollment completion
- Session revocation during password resets must be immediate and complete
- Audit logging must record all state changes transactionally

PostgreSQL's full ACID compliance prevents race conditions and data corruption.

### 6. **Performance & Indexes**
PostgreSQL provides:
- Composite indexes for multi-column queries (e.g., `organizationId, role`)
- Partial indexes for status queries (e.g., active enrollments only)
- EXPLAIN ANALYZE for query optimization
- Connection pooling with PgBouncer for high concurrency

### 7. **Mature Ecosystem**
- **Prisma ORM**: Type-safe database client with migrations and introspection
- **Migration Tools**: Versioned schema management with audit trails
- **Monitoring**: pgAdmin, pg_stat_statements for performance insights
- **Replication**: Built-in streaming replication for backups
- **Community**: Extensive third-party tools and documentation

### 8. **Open Source & Cost**
- No licensing costs (unlike Oracle, SQL Server)
- Self-hosted or managed cloud options (AWS RDS, Azure Database, DigitalOcean)
- No vendor lock-in
- Active open-source community

## Alternatives Considered

### MySQL/MariaDB
- ✗ Weaker transaction isolation levels
- ✗ Historically less reliable RLS options
- ✗ JSON support less mature
- ✓ Simpler deployment

### NoSQL (MongoDB, DynamoDB)
- ✗ No ACID transactions at scale (DynamoDB transactions are limited)
- ✗ Complex application-level joins for course/enrollment queries
- ✗ Weaker referential integrity (deletes require manual cascade logic)
- ✗ Harder to enforce multi-tenant isolation
- ✓ Flexible schema (not needed with strong types)

### Cloud-Native Databases (Firebase, Supabase)
- ✓ Managed PostgreSQL backend (Supabase)
- ✗ Vendor lock-in concerns
- ✗ Higher costs at scale
- ✗ Less control over performance tuning

## Consequences

### Positive
- ✓ Strong data integrity and consistency
- ✓ Efficient, predictable query performance
- ✓ Type-safe with Prisma ORM
- ✓ Easy multi-tenant isolation via row-level security
- ✓ Mature ecosystem and wide adoption
- ✓ Cost-effective at any scale

### Negative
- ✗ Requires migration path if migrating from NoSQL
- ✗ Operational complexity for horizontal scaling (sharding not built-in)
- ✗ Not ideal for unstructured, schemaless data
- ✗ Database size grows with full ACID logging

## Implementation

LearnFlow uses PostgreSQL via:
- **Prisma Client**: `@prisma/client@4.16.2` for type-safe queries
- **Database URL**: `DATABASE_URL` environment variable pointing to PostgreSQL connection string
- **Migrations**: Versioned `.sql` files in `prisma/migrations/`
- **Connection Pooling**: App configures connection limits via Prisma
- **Schema**: `prisma/schema.prisma` defines all 25+ tables with relationships

### Example: Tenant Isolation
```prisma
model UserOrganization {
  organizationId String  // Tenant identifier
  userId         String
  role           UserRole
  
  @@unique([userId, organizationId])  // Prevent duplicate memberships
  @@index([organizationId])            // Fast tenant queries
}
```

## Related Decisions

- **ADR-002**: Multi-Tenancy Strategy (uses PostgreSQL for isolation)
- **ADR-003**: Authentication Strategy (sessions stored in PostgreSQL + Redis)

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Client Docs](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Multi-Tenant SaaS Architecture](https://www.postgresql.org/docs/current/sql-syntax.html)
