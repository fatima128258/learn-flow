# System Architecture

This document describes the LearnFlow Learning Management System architecture, including system design, layering, data flow, and deployment considerations.

## High-Level Architecture

LearnFlow follows a **multi-tier, multi-tenant architecture** designed for scalability, maintainability, and security:

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│                    (Next.js Frontend)                        │
│              - React Components & Pages                      │
│              - State Management (React Query)                │
│              - Authentication Context                        │
│              - E2E Tests (Playwright)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST ↓
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                          │
│                   (Express.js Server)                        │
│         - Routing & Middleware Pipeline                      │
│         - Request/Response Handling                          │
│         - CORS & Security Headers                           │
│         - Session Authentication                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ Internal ↓
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                        │
│                   (Service Classes)                          │
│         - Course Management Logic                           │
│         - User & Auth Services                              │
│         - Enrollment & Payment Logic                        │
│         - Notification Dispatch                             │
│         - Audit & Compliance                                │
└─────────────────────────────────────────────────────────────┘
                            ↓ Internal ↓
┌─────────────────────────────────────────────────────────────┐
│                  Data Access Layer                           │
│                  (Prisma Repositories)                       │
│         - Type-Safe Database Queries                        │
│         - Transaction Management                            │
│         - Query Optimization                                │
│         - Migration Management                              │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL/TCP ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│              - PostgreSQL (15+)                              │
│              - Redis (Caching & Sessions)                    │
│              - Meilisearch (Full-Text Search)               │
│              - Cloudinary (File Storage)                     │
│              - BullMQ (Job Queue)                            │
└─────────────────────────────────────────────────────────────┘
```

## Application Layers

### 1. Presentation Layer (Frontend)

**Technology**: Next.js 16.3 + TypeScript + Tailwind CSS

**Responsibilities**:
- User interface rendering
- Form handling and validation
- State management (React Query for server state)
- Client-side authentication
- Real-time notifications
- Page routing and navigation

**Key Components**:
- Dashboard pages (admin, instructor, student views)
- Course builder interface
- Student learning interface
- Authentication forms
- Shared UI components (@learnflow/ui)

### 2. API Layer (Express.js Backend)

**Technology**: Express.js + TypeScript

**Responsibilities**:
- HTTP request routing
- Request/response validation
- Authentication & authorization
- CORS handling
- Error handling middleware
- Rate limiting
- Request logging

**Middleware Stack** (in order):
1. CORS middleware
2. JSON body parser
3. Session middleware (Redis-based)
4. Authentication check (optional)
5. Authorization check (role-based)
6. Request logging
7. Route handler

### 3. Business Logic Layer (Services)

**Location**: `apps/api/src/services/`

**Responsibilities**:
- Course creation and management
- User authentication and registration
- Enrollment workflow
- Payment processing
- Certificate generation
- Notification dispatch
- Audit logging
- Business rule enforcement

**Key Services**:
- `authService.ts` - User authentication and password management
- `courseService.ts` - Course CRUD and publishing
- `enrollmentService.ts` - Student enrollment workflow
- `organizationService.ts` - Multi-tenant organization management
- `notificationService.ts` - In-app notifications
- `auditLogService.ts` - Compliance audit trails

### 4. Data Access Layer (Repositories)

**Location**: `apps/api/src/repositories/`

**Responsibilities**:
- Type-safe Prisma queries
- Transaction management
- Query optimization
- Repository pattern implementation

**Key Repositories**:
- `authRepository.ts` - User, session, token operations
- `courseRepository.ts` - Course, module, lesson queries
- `enrollmentRepository.ts` - Enrollment data access
- `organizationRepository.ts` - Organization queries

### 5. Infrastructure Layer

**Components**:

#### PostgreSQL Database
- Primary data store
- ACID compliance
- Complex relationships (courses, enrollments, quizzes)
- Indexes for performance

#### Redis Cache
- Session token storage
- Cache layer for frequently accessed data
- BullMQ job queue backend
- Real-time data

#### Meilisearch
- Full-text search engine
- Fast course discovery
- Relevance ranking

#### Cloudinary
- Media file storage
- Course thumbnails and resources
- Certificate images
- Scalable CDN delivery

#### BullMQ (Redis-backed)
- Asynchronous job processing
- Email sending queue
- Certificate generation
- Notification dispatch
- Retry logic with exponential backoff

## Multi-Tenancy Architecture

LearnFlow implements **row-level multi-tenancy** with the following design:

### Tenant Isolation Strategy

```
┌─────────────────────────────────┐
│  Organization A                  │
│  ├─ Users (Role: ORG_ADMIN)     │
│  ├─ Users (Role: INSTRUCTOR)    │
│  ├─ Users (Role: STUDENT)       │
│  ├─ Courses                      │
│  ├─ Enrollments                  │
│  └─ Certificates                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Organization B                  │
│  ├─ Users (Role: INSTRUCTOR)    │
│  ├─ Users (Role: STUDENT)       │
│  ├─ Courses                      │
│  ├─ Enrollments                  │
│  └─ Certificates                 │
└─────────────────────────────────┘
```

### User-Organization Relationship

Every user can belong to multiple organizations with different roles:

```sql
-- UserOrganization junction table
userId_organizationId (UNIQUE)
├─ userId
├─ organizationId
└─ role (PLATFORM_ADMIN | ORG_ADMIN | INSTRUCTOR | STUDENT)
```

### Query-Level Filtering

All queries automatically scope data to the organization via:

1. **Session context**: `req.organizationId` from authenticated session
2. **Query WHERE clauses**: Filter by `organizationId` on all multi-tenant tables
3. **Middleware validation**: Ensure user has access to requested organization

### Platform Admin Access

Platform admins bypass organization scoping:
- Can access any organization's data
- Can create/modify organizations
- Can view audit logs across all orgs
- Used in `src/middleware/auth.ts` via role checks

## Data Flow

### Authentication Flow

```
User Login Request
    ↓
[authController.login] 
    ↓
[authService.authenticate]
    ├─ Verify email exists
    ├─ Verify password vs argon2 hash
    └─ Create session token
    ↓
[sessionStorage - Redis]
    ├─ Hash token with SHA256
    └─ Store session data (30-day TTL)
    ↓
Return encrypted session cookie
    ↓
Browser stores cookie
    ↓
Subsequent requests include cookie
    ↓
[authMiddleware]
    ├─ Extract token from cookie
    ├─ Verify against Redis
    └─ Populate req.user
    ↓
Authorized request proceeds
```

### Course Creation Flow

```
Instructor creates course
    ↓
[courseController.create]
    ↓
[courseService.createCourse]
    ├─ Validate input (title, org, instructor)
    ├─ Generate slug from title
    └─ Create course record (DRAFT status)
    ↓
[courseRepository.createCourse]
    ├─ Prisma create with organization scope
    └─ Return created course
    ↓
[auditLogService.record]
    ├─ Log action: COURSE_CREATED
    └─ Store actor details
    ↓
Return created course to frontend
    ↓
Frontend updates UI
    ↓
Instructor adds modules/lessons
    ↓
[Repeat for each module/lesson]
    ↓
Instructor publishes course
    ↓
[courseService.publishCourse]
    ├─ Validate course readiness
    ├─ Update status to PUBLISHED
    ├─ Set publishedAt timestamp
    └─ Update Meilisearch index
    ↓
[notificationService.dispatch]
    ├─ Queue notification event
    └─ Store in database
    ↓
Course visible to students
```

### Background Job Processing

```
Service enqueues job
    ↓
[BullMQ - Redis backend]
    ├─ Store job data
    └─ Set retry configuration (3 attempts, exponential backoff)
    ↓
Job worker processes
    ├─ Attempt 1: Execute
    ├─ If fails: Queue for retry
    ├─ Attempt 2: Re-execute
    └─ If fails: Move to dead letter queue
    ↓
On success: Remove from queue
On failure: Log error & store in dead letter queue
```

## Performance Optimizations

### Database Indexes

Strategic indexes on high-volume queries:

```sql
-- User organization lookups
CREATE INDEX ON UserOrganization(organizationId, role);

-- Course queries
CREATE INDEX ON Course(organizationId, status, publishedAt);

-- Progress tracking
CREATE INDEX ON CourseProgress(userId, courseId);
CREATE INDEX ON LessonProgress(userId, lessonId);

-- Enrollments
CREATE INDEX ON Enrollment(userId, courseId);
CREATE INDEX ON Enrollment(courseId, status);
```

### Caching Strategy

**Redis Cache Layers**:
1. **Session Cache** - Auth tokens (7-day TTL)
2. **Query Cache** - Frequently accessed data (configurable TTL)
3. **User Data** - Organization memberships (60-second TTL)
4. **Search Cache** - Meilisearch results (varies by query)

**Cache Invalidation**:
- On data mutation, invalidate related cache keys
- TTL-based expiration for eventually-consistent data

### Query Optimization

- **Eager loading**: Use Prisma `include` to fetch related data in one query
- **Selective fields**: Use `select` to fetch only needed columns
- **Pagination**: Limit results with `take`/`skip`
- **Connection pooling**: Configured in DATABASE_URL

## Security Architecture

### Authentication
- Session-based with Redis backend
- Argon2 password hashing (memory-hard, resistant to GPU attacks)
- Token SHA256 hashing for storage
- Secure cookie flags: `HttpOnly`, `SameSite=Lax`

### Authorization
- Role-based access control (RBAC)
- Organization-scoped permissions
- Middleware-enforced checks

### Data Protection
- CORS configured for allowed origins
- SQL injection prevention via Prisma parameterization
- Rate limiting on auth endpoints
- HTTPS enforcement in production

### Audit & Compliance
- All user actions logged to AuditLog table
- Actor identification (userId, role, email, IP address)
- Immutable audit records
- Retention policy configurable

## Deployment Architecture

### Development Environment
```
Docker Compose
├─ PostgreSQL (port 5432)
├─ Redis (port 6379)
├─ Meilisearch (port 7700)
├─ Mailpit SMTP (port 1025)
├─ Express API (port 4000)
└─ Next.js Frontend (port 3000)
```

### Production Considerations

**Horizontal Scaling**:
- Stateless API servers (sessions in Redis, not memory)
- Load balancer distributes requests
- PostgreSQL read replicas for reporting

**Caching Layer**:
- CDN for static assets (Next.js build)
- Redis cluster for distributed caching
- Meilisearch cluster for search scalability

**Job Processing**:
- BullMQ workers on separate instances
- Job distribution via Redis
- Dead letter queues for failed jobs

**Monitoring & Logging**:
- Application logs aggregated
- Database slow query logs
- Redis monitoring for cache hit ratio
- Error tracking and alerting

## Deployment Models

### Single Instance
- Suitable for development/staging
- All services on one server
- Docker Compose simplifies setup

### Multi-Instance (HA)
- API servers behind load balancer
- PostgreSQL with replication
- Redis cluster
- Meilisearch cluster
- Separate job worker instances

### Containerized (Kubernetes-Ready)
- Each service as separate container
- Stateless API design supports scaling
- ConfigMaps for environment configuration
- PersistentVolumes for databases

## Dependencies & Integration Points

```
LearnFlow API
├─ PostgreSQL (primary data)
├─ Redis (sessions, cache, queues)
├─ Meilisearch (search)
├─ Cloudinary (file storage)
├─ Email Service (Nodemailer → Mailpit/SMTP)
└─ PDF Generation (PDFKit)

LearnFlow Frontend
├─ API Server (REST endpoints)
├─ Authentication (Session cookies)
├─ Analytics (optional Google Analytics)
└─ Error Tracking (optional Sentry)
```

## Technology Decisions

See Architecture Decision Records (ADRs) in `docs/decisions/` for rationale on:
- ADR-001: PostgreSQL vs. alternatives
- ADR-002: Multi-tenancy approach
- ADR-003: Authentication strategy
- ADR-004: Course creation slice
- ADR-005: Object storage (Cloudinary)