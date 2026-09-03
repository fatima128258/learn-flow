# LearnFlow

A comprehensive, multi-tenant learning management system (LMS) platform designed for organizations to create, manage, and monetize online courses with built-in e-commerce, enrollment tracking, and certificate generation.

## Project Overview

LearnFlow is a full-stack SaaS learning management system that empowers educational organizations to:

- **Create & Manage Courses** - Structure courses into modules and lessons with flexible content types
- **Manage Multiple Organizations** - Support multiple tenants with role-based access control (RBAC)
- **Student Learning Paths** - Track learner progress through courses with lesson and quiz completion
- **Assessment & Quizzes** - Build interactive quizzes with multiple-choice questions and scoring
- **E-Commerce Integration** - Sell courses with orders, payments, and pricing control
- **Certificate Generation** - Generate and verify certificates upon course completion
- **Full-Text Search** - Powered by Meilisearch for fast course discovery
- **Notifications** - Real-time notifications for key platform events
- **File Storage** - Cloudinary integration for media management
- **Audit Logging** - Comprehensive audit trails for compliance and security

The platform follows a monorepo structure with a Next.js frontend, Express.js backend, PostgreSQL database, and Redis for caching and job queues.

## Key Features

### Course Management
- Multi-module course structure with ordered lessons
- Course categories and taxonomy
- Draft, review, and published course statuses
- Difficulty levels and learning objectives
- Customizable pricing with discount support
- Thumbnail and media management

### Learning & Progress Tracking
- Lesson-by-lesson progress tracking
- Course completion status
- Last visited tracking for seamless resumption
- Module and lesson sequencing
- Preview mode for sample content

### Assessment & Quizzes
- Multi-question quizzes with configurable settings
- Question ordering and scoring
- Passing percentage thresholds
- Multiple attempt limits
- Automatic pass/fail determination

### User Management & Authentication
- Email-based authentication with session tokens
- Email verification flow
- Password reset functionality
- Role-based access control (RBAC):
  - Platform Admin
  - Organization Admin
  - Instructor
  - Student
- Multi-organization support with organization-specific roles

### Enrollment & E-Commerce
- Student course enrollment
- Order management with multiple items
- Payment processing (mock provider ready)
- Order status tracking (pending, paid, failed, cancelled, refunded)
- Enrollment status management

### Certificates
- Automatic certificate generation upon completion
- PDF certificate storage and retrieval
- Unique verification tokens for certificate validation
- Certificate metadata including instructor and organization

### Notifications & Communication
- In-app notification system
- Event-driven notifications:
  - Welcome notifications
  - Enrollment confirmations
  - Course completion
  - Certificate generation
  - Password reset
  - Course published
  - Course purchased
- Unread notification tracking
- Background job processing

### Search & Discovery
- Full-text course search via Meilisearch
- Fast and relevant search results
- Category-based filtering

### File Management
- Cloudinary integration for media storage
- Lesson resource attachments
- Organization-scoped file management
- MIME type tracking

### Audit & Compliance
- Comprehensive audit logging
- User action tracking
- Resource modification history
- IP address logging
- Actor identification and role capture

## Tech Stack

### Frontend
- **Framework**: Next.js 16.3
- **Language**: TypeScript
- **Runtime**: Node.js
- **Styling**: Tailwind CSS
- **HTTP Client**: React Query (TanStack Query 5)
- **Testing**: Playwright (E2E tests)
- **Linting**: ESLint

### Backend
- **Framework**: Express.js
- **Language**: TypeScript
- **Runtime**: Node.js
- **Authentication**: Session-based with token hashing (Argon2)
- **ORM**: Prisma 4.16
- **File Upload**: Multer
- **Password Hashing**: Argon2
- **PDF Generation**: PDFKit
- **Email**: Nodemailer

### Database & Storage
- **Primary Database**: PostgreSQL 15
- **Cache/Sessions**: Redis 7
- **Search Engine**: Meilisearch 1.11
- **File Storage**: Cloudinary
- **Email Testing**: Mailpit (development)

### DevOps & Infrastructure
- **Containerization**: Docker & Docker Compose
- **Process Management**: Node.js with ts-node-dev (dev), PM2-ready (production)
- **Job Queuing**: BullMQ (with Redis backend)
- **Testing**: Vitest (unit/integration), Playwright (E2E)

### Shared Packages
- `@learnflow/validation` - Shared validation schemas
- `@learnflow/config` - Configuration management
- `@learnflow/types` - Shared TypeScript types
- `@learnflow/ui` - Shared UI components

## Application Architecture

```mermaid
graph TB
    Client["Web Client<br/>(Next.js)"]
    API["API Server<br/>(Express)"]
    Auth["Authentication<br/>(Sessions + Argon2)"]
    DB["PostgreSQL<br/>(Prisma ORM)"]
    Redis["Redis Cache<br/>(ioredis)"]
    Search["Meilisearch<br/>(Full-text Search)"]
    Storage["Cloudinary<br/>(File Storage)"]
    Queue["Job Queue<br/>(BullMQ)"]
    Email["Email Service<br/>(Nodemailer)"]
    PDF["Certificate PDF<br/>(PDFKit)"]

    Client -->|HTTP/REST| API
    API -->|Session Token| Auth
    Auth -->|Verify| Redis
    API -->|Query/Mutate| DB
    API -->|Cache| Redis
    API -->|Index| Search
    API -->|Upload| Storage
    API -->|Enqueue| Queue
    Queue -->|Generate| PDF
    Queue -->|Send| Email

    style Client fill:#3b82f6
    style API fill:#10b981
    style Auth fill:#f59e0b
    style DB fill:#8b5cf6
    style Redis fill:#ec4899
    style Search fill:#06b6d4
    style Storage fill:#f97316
    style Queue fill:#6366f1
```

## Project Structure

```
learn-flow/
├── apps/
│   ├── api/                          # Express backend
│   │   ├── src/
│   │   │   ├── controllers/          # Request handlers
│   │   │   ├── services/             # Business logic
│   │   │   ├── repositories/         # Data access layer
│   │   │   ├── routes/               # API routes
│   │   │   ├── middleware/           # Express middleware
│   │   │   ├── queues/               # Job queues (BullMQ)
│   │   │   ├── config/               # Configuration
│   │   │   ├── storage/              # File storage integration
│   │   │   └── __tests__/            # Unit & integration tests
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Data model definition
│   │   │   ├── migrations/           # Database migrations
│   │   │   └── seed.js               # Database seeding
│   │   ├── Dockerfile                # Backend Docker image
│   │   └── package.json
│   │
│   └── web/                          # Next.js frontend
│       ├── src/
│       │   ├── app/                  # App Router (pages)
│       │   ├── components/           # Reusable React components
│       │   ├── features/             # Feature modules
│       │   ├── lib/                  # Utility functions
│       │   ├── design/               # Design tokens & styles
│       │   └── providers/            # Context providers
│       ├── e2e/                      # End-to-end tests
│       ├── Dockerfile                # Frontend Docker image
│       └── package.json
│
├── packages/                         # Shared monorepo packages
│   ├── validation/                   # Shared validation schemas
│   ├── types/                        # Shared TypeScript types
│   ├── ui/                           # Shared UI components
│   └── config/                       # Shared configuration
│
├── docker-compose.yml                # Local development stack
├── package.json                      # Root workspace config
└── .env.example                      # Environment template

```

## Getting Started

### Prerequisites

- **Node.js**: 18+ (v20 recommended)
- **npm**: 9+
- **Docker** (optional, for containerized development)
- **Git**: For version control

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd learn-flow
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the development database stack**
```bash
docker-compose up -d
```

5. **Run database migrations and seed**
```bash
npm run seed
```

6. **Start the development server**
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000` and the API at `http://localhost:4000`.

### Docker Compose Quick Start

For a complete isolated environment:

```bash
# Build and start all services
docker-compose up --build

# Run migrations and seed (in another terminal)
docker-compose run --rm api-setup
```

Services will be available at:
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`
- Mailpit (email testing): `http://localhost:8025`
- Meilisearch: `http://localhost:7700`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### Available Scripts

```bash
# Development
npm run dev                 # Start Next.js frontend dev server
npm run build              # Build frontend for production
npm run start              # Start production frontend server

# API (from apps/api directory)
npm --prefix ./apps/api run dev     # Start API dev server
npm --prefix ./apps/api run build   # Build API

# Database
npm --prefix ./apps/api run migrate:deploy  # Apply migrations
npm --prefix ./apps/api run seed            # Seed database

# Testing
npm test                   # Run all tests
npm run test:coverage      # Run tests with coverage

# Linting
npm run lint               # Lint all packages
```

## Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `POSTGRES_USER` | Database username | `learnflow` |
| `POSTGRES_PASSWORD` | Database password | `learnflow_pass` |
| `POSTGRES_DB` | Database name | `learnflow_db` |
| `DATABASE_URL` | Prisma connection string | postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db |
| `REDIS_URL` | Redis connection | redis://localhost:6379 |
| `MAIL_SMTP_HOST` | SMTP server hostname | localhost |
| `MAIL_SMTP_PORT` | SMTP server port | 1025 |
| `MAIL_FROM` | Email sender address | no-reply@learnflow.local |
| `APP_URL` | Frontend application URL | http://localhost:3000 |
| `SESSION_COOKIE_NAME` | Session cookie name | learnflow_session |
| `SESSION_COOKIE_SECURE` | HTTPS only cookies | false |
| `SESSION_TTL_SECONDS` | Session expiration time | 604800 (7 days) |
| `CORS_ALLOWED_ORIGINS` | CORS origins (comma-separated) | (empty for local dev) |
| `ADMIN_EMAIL` | Default platform admin email | admin@gmail.com |
| `ADMIN_PASSWORD` | Default platform admin password | admin123 |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | (required for production) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | (required for production) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | (required for production) |
| `MEILISEARCH_HOST` | Meilisearch server URL | http://localhost:7700 |
| `MEILISEARCH_API_KEY` | Meilisearch master key | masterKey |

**Note**: Never commit real secrets to version control. Use `.env` for local development only.

## Authentication & Authorization

### Authentication Flow

LearnFlow uses **session-based authentication**:

1. Users authenticate via email and password
2. Passwords are hashed using **Argon2** (memory-hard algorithm)
3. Upon successful authentication, a session token is issued
4. Sessions are stored in **Redis** with configurable TTL (default: 7 days)
5. Subsequent requests validate the session token

### User Roles & Permissions

The platform implements role-based access control (RBAC) with four roles:

| Role | Scope | Permissions |
|------|-------|-------------|
| **Platform Admin** | System-wide | Full system access, organization management, audit logs |
| **Org Admin** | Organization | Organization settings, user management, course approval |
| **Instructor** | Organization | Create and manage courses, view analytics, publish courses |
| **Student** | Organization | Enroll in courses, complete lessons, take quizzes, view certificates |

Roles are assigned per organization via the `UserOrganization` table, enabling users to have different roles across organizations.

### Session Management

- Session tokens are hashed using Argon2 before storage
- Sessions can be revoked by setting the `revoked` flag
- Configurable session TTL via `SESSION_TTL_SECONDS`
- Secure cookie transmission via `SESSION_COOKIE_SECURE` (must be `true` in production)

## API / Backend

### Core API Structure

The API follows a layered architecture:

- **Routes** (`/routes`) - HTTP endpoint definitions
- **Controllers** (`/controllers`) - Request/response handling
- **Services** (`/services`) - Business logic
- **Repositories** (`/repositories`) - Data access layer (Prisma)
- **Middleware** (`/middleware`) - Cross-cutting concerns

### Key API Endpoints

#### Authentication
```
POST   /api/v1/auth/signup              # Register new user
POST   /api/v1/auth/login               # Authenticate user
POST   /api/v1/auth/logout              # End session
POST   /api/v1/auth/verify-email        # Verify email token
POST   /api/v1/auth/request-reset       # Request password reset
POST   /api/v1/auth/reset-password      # Reset password with token
```

#### Courses
```
GET    /api/v1/courses                  # List courses (with filters)
GET    /api/v1/courses/:id              # Get course details
POST   /api/v1/courses                  # Create course (Instructor+)
PUT    /api/v1/courses/:id              # Update course (Owner+)
DELETE /api/v1/courses/:id              # Delete course (Owner+)
POST   /api/v1/courses/:id/publish      # Publish course (Org Admin+)
```

#### Enrollment
```
POST   /api/v1/enrollments              # Enroll in course
GET    /api/v1/enrollments              # List student enrollments
GET    /api/v1/courses/:id/enrollments  # List course enrollments (Instructor+)
```

#### Student Learning
```
GET    /api/v1/student-learning/dashboard  # Get learning dashboard
GET    /api/v1/student-learning/progress   # Get course progress
POST   /api/v1/student-learning/resume     # Resume course learning
```

#### Quizzes & Progress
```
GET    /api/v1/quizzes/:id              # Get quiz details
POST   /api/v1/quizzes/:id/attempt      # Submit quiz attempt
GET    /api/v1/progress/lesson          # Get lesson progress
POST   /api/v1/progress/lesson          # Mark lesson as complete
```

#### Certificates
```
GET    /api/v1/certificates             # List student certificates
POST   /api/v1/certificates/:id/download # Download certificate PDF
GET    /api/v1/certificates/verify/:token # Public certificate verification
```

#### Search
```
GET    /api/v1/search/courses           # Full-text search courses
```

#### Notifications
```
GET    /api/v1/notifications            # List notifications
PUT    /api/v1/notifications/:id/read   # Mark as read
DELETE /api/v1/notifications/:id        # Delete notification
```

#### Admin (Organization Management)
```
GET    /api/v1/admin/organizations      # List organizations
POST   /api/v1/admin/organizations      # Create organization
GET    /api/v1/admin/audit-logs         # Platform audit logs
```

#### Organization Admin
```
GET    /api/v1/org-admin/users          # List org users
POST   /api/v1/org-admin/users          # Invite user
PUT    /api/v1/org-admin/users/:id/role # Update user role
GET    /api/v1/org-admin/audit-logs     # Organization audit logs
```

All protected endpoints require valid session authentication. Some endpoints require specific roles (e.g., instructor, admin).

## Database

### Database Technology

- **PostgreSQL 15** - Primary relational database
- **Prisma 4.16** - TypeScript ORM for type-safe data access
- **Redis 7** - Session storage and caching

### Schema Overview

The database is organized into logical domains:

#### User & Auth
- `User` - User accounts
- `UserOrganization` - User-organization membership with roles
- `Session` - Active user sessions
- `EmailVerificationToken` - Email verification tokens
- `PasswordResetToken` - Password reset tokens

#### Organization
- `Organization` - Multi-tenant organization records
- `AuditLog` - Audit trail for compliance

#### Content
- `Course` - Course metadata (title, description, pricing, status)
- `Module` - Course modules (ordered sections)
- `Lesson` - Module lessons with content and resources
- `Category` - Course categorization

#### Learning & Progress
- `Enrollment` - Student course enrollment
- `LessonProgress` - Per-lesson completion tracking
- `CourseProgress` - Per-course completion tracking

#### Assessment
- `Quiz` - Quiz configuration
- `Question` - Quiz questions
- `QuizOption` - Multiple-choice options
- `QuizAttempt` - Quiz submission records with scores

#### Commerce
- `Order` - Student purchase orders
- `OrderItem` - Individual items in orders
- `Payment` - Payment records (provider-agnostic)

#### Certificates & Media
- `Certificate` - Generated certificates with verification tokens
- `Media` - Uploaded files (stored in Cloudinary)

#### Notifications
- `Notification` - In-app notifications with read status

### Key Indexes

The schema includes strategic indexes for performance:
- User-organization queries: `(organizationId, role)`
- Course lookups: `(organizationId, status, publishedAt)`
- Progress tracking: `(userId, courseId)`, `(userId, lessonId)`
- Notifications: `(userId, readAt)` for unread queries

### Migrations

Database migrations are located in `apps/api/prisma/migrations/`. Use Prisma CLI to manage migrations:

```bash
npm --prefix ./apps/api run migrate:deploy   # Apply migrations
prisma migrate dev --name <migration_name>   # Create new migration
```

## Testing

### Test Framework: Vitest

Unit and integration tests use **Vitest**:

```bash
npm test                # Run all tests once
npm run test:coverage   # Run with coverage report
```

### E2E Testing: Playwright

End-to-end tests are defined in `apps/web/e2e/` and use **Playwright**:

```bash
npx playwright test                # Run all E2E tests
npx playwright test --ui           # Run with UI (watch mode)
npx playwright test --debug        # Run with inspector
npx playwright test e2e/auth.spec.ts  # Run specific test file
```

Configuration: `playwright.config.ts`

## Deployment

### Build for Production

```bash
# Frontend build
npm run build

# API build
npm --prefix ./apps/api run build
```

### Docker Deployment

The project includes Dockerfiles for both frontend and backend:

```bash
# Build images
docker build -f apps/api/Dockerfile -t learnflow-api .
docker build -f apps/web/Dockerfile -t learnflow-web .

# Or use docker-compose for complete stack
docker-compose up --build
```

### Environment Configuration

For production deployment:

1. **Set `SESSION_COOKIE_SECURE=true`** for HTTPS
2. **Configure `CORS_ALLOWED_ORIGINS`** with your frontend URL
3. **Set Cloudinary credentials** for file storage
4. **Configure Meilisearch** with a strong API key
5. **Use strong `ADMIN_PASSWORD`** (change from default)
6. **Set up PostgreSQL** with proper backups and security
7. **Configure Redis** with appropriate persistence

### Services & Dependencies

Production deployment should include:
- PostgreSQL 15+ with replication/backup
- Redis 7+ with persistence
- Meilisearch with authentication
- Cloudinary account (or compatible S3-compatible storage)
- Node.js 18+ LTS
- Reverse proxy (Nginx/Apache) for SSL/TLS

## Future Improvements

The following enhancements are potential future additions:

- **Live Classes**: Integration with video conferencing (Zoom, Jitsi)
- **Discussion Forums**: Community engagement and peer learning
- **Analytics Dashboard**: Detailed learner analytics and reporting
- **Mobile App**: Native iOS/Android applications
- **Advanced Payment Methods**: Stripe, PayPal, local payment processors
- **Learning Paths**: Prerequisite-based course sequences
- **Instructor Analytics**: Comprehensive course performance metrics
- **Bulk User Import**: CSV import for user management
- **API Rate Limiting**: Enhanced rate limiting per organization
- **Machine Learning**: Course recommendations based on learner behavior
- **Accessibility Enhancements**: Full WCAG 2.1 AA compliance
- **Internationalization**: Multi-language support

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass and code is linted
4. Submit a pull request with a clear description

## License

This project is proprietary and not open source. All rights reserved.

---

**For questions or support, please contact the development team.**
