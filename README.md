# LearnFlow - Enterprise Learning Management System

A scalable, multi-tenant learning management platform built with modern web technologies. LearnFlow enables organizations to create, manage, and deliver online courses with comprehensive learning analytics, role-based access control, and built-in commerce capabilities.

**Live Deployment:**
- **Frontend:** https://learn-flow-web-indol.vercel.app
- **Backend API:** https://learn-flow-1-1gl3.onrender.com

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Live Deployment](#live-deployment)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Features](#features)
6. [Role-Based Access Control](#role-based-access-control)
7. [Authentication Flow](#authentication-flow)
8. [Multi-Tenancy & Data Isolation](#multi-tenancy--data-isolation)
9. [API Documentation](#api-documentation)
10. [Environment Variables](#environment-variables)
11. [Local Development Setup](#local-development-setup)
12. [Database](#database)
13. [Deployment](#deployment)
14. [Project Structure](#project-structure)
15. [Frontend Architecture](#frontend-architecture)
16. [Backend Architecture](#backend-architecture)
17. [User Journey](#user-journey)
18. [Security](#security)
19. [Troubleshooting](#troubleshooting)

---

## Project Overview

**What is LearnFlow?**

LearnFlow is an enterprise-grade Learning Management System (LMS) designed for organizations to deliver structured online education. The platform supports the complete lifecycle of course creation, student enrollment, interactive learning, and performance tracking.

**Problem it Solves:**

- **Course Management:** Organizations need an easy way to organize courses into modules, lessons, and assessments
- **Role-Based Control:** Different stakeholders (admins, instructors, students) need appropriate access levels
- **Student Progress Tracking:** Educators need visibility into learner engagement and completion
- **Multi-Organization Support:** Enterprise platforms need tenant isolation and per-organization customization
- **Verification & Credentials:** Students need verifiable certificates upon course completion

**Who Can Use It:**

- **Platform Administrators:** Manage system-wide settings, organizations, and platform analytics
- **Organization Administrators:** Manage organization users, courses, and organization-level analytics
- **Instructors:** Create and manage courses, modules, lessons, quizzes, and student enrollment
- **Students:** Enroll in courses, complete lessons, take quizzes, track progress, and earn certificates

**Main Platform Capabilities:**

- Multi-tenant organization management with complete data isolation
- Course authoring with modules, lessons, and multimedia content
- Interactive quiz engine with multiple-choice questions and scoring
- Student enrollment and learning progress tracking
- Automated certificate generation with verification tokens
- Role-based access control with four distinct roles
- Email verification and password reset flows
- Rate limiting and security headers for production readiness
- Audit logging for compliance and accountability

---

## Live Deployment

### Frontend (Vercel)
**URL:** https://learn-flow-web-indol.vercel.app

The frontend is a Next.js application deployed on Vercel. It communicates with the backend API via HTTPS requests with credentials enabled (cookies).

### Backend API (Render)
**URL:** https://learn-flow-1-1gl3.onrender.com

The backend is a Node.js/Express server deployed on Render. It provides RESTful APIs and manages all business logic, database operations, and multi-tenant isolation.

### Communication Architecture

```
Browser
  ↓ HTTPS
Frontend (Vercel) 
  ↓ HTTPS/API Requests with credentials: 'include'
Backend API (Render)
  ↓ PostgreSQL queries
Database (Supabase PostgreSQL)
```

**Frontend Environment Variable:** `NEXT_PUBLIC_API_URL=https://learn-flow-1-1gl3.onrender.com`

This variable controls which backend the frontend connects to. In production, both frontend and backend handle CORS and secure cookies appropriately.

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.3.1 | React framework with App Router, SSR, and built-in optimization |
| **React** | 19.2.8 | UI library for component-based architecture |
| **TypeScript** | ^5 | Static type checking for safer code |
| **React Query (TanStack)** | ^5.102.8 | Server state management and data fetching |
| **Tailwind CSS** | ^3.4.1 | Utility-first CSS framework |
| **Playwright** | ^1.62.1 | End-to-end testing framework |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Express** | ^4.18.2 | Lightweight web framework and routing |
| **TypeScript** | ^5 | Static type checking on server |
| **Prisma** | ^4.16.2 | Type-safe ORM for database access |
| **PostgreSQL** | - | Production relational database |
| **Redis (ioredis)** | 5.3.2 | Session/cache layer and rate limiting |
| **BullMQ** | ^6.3.1 | Job queue for background tasks (notifications) |

### Database & ORM
| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary relational database for all application data |
| **Prisma** | Type-safe ORM with schema-driven migrations |
| **Supabase PostgreSQL** | Production database hosting (includes PostgRES) |

### Authentication & Security
| Technology | Purpose |
|-----------|---------|
| **Session Cookies** | Stateful authentication with HttpOnly, Secure flags |
| **Argon2** | Password hashing algorithm (OWASP recommended) |
| **Email Verification** | Token-based email verification on signup |
| **Password Reset** | Time-limited reset tokens via email |

### Storage & Content
| Technology | Purpose |
|-----------|---------|
| **Cloudinary** | Cloud object storage for media and course assets |
| **PDFKit** | Server-side PDF generation for certificates |
| **Nodemailer** | Transactional email sending (SMTP) |

### Caching & Rate Limiting
| Technology | Purpose |
|-----------|---------|
| **Redis** | Session store, rate limiting counter, job queue |
| **Lua Scripts** | Atomic rate limiting with sliding window algorithm |

### Validation
| Technology | Purpose |
|-----------|---------|
| **@learnflow/validation** | Custom validation package (monorepo) |
| **Input Validation** | Inline validation for email, password strength, etc. |

### Deployment & Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Vercel** | Frontend hosting with serverless functions and CDN |
| **Render** | Backend hosting with managed PostgreSQL and Redis |
| **Docker** | Containerization (docker-compose for local development) |

### Testing
| Technology | Purpose |
|-----------|---------|
| **Vitest** | Unit testing framework (Vite-compatible) |
| **Supertest** | HTTP assertion library for API testing |

### UI & Styling
| Technology | Purpose |
|-----------|---------|
| **Tailwind CSS** | Utility-first CSS for rapid UI development |
| **PostCSS** | CSS transformation and optimization |
| **Autoprefixer** | Vendor prefix handling for browser compatibility |

---

## Architecture

### High-Level System Design

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTPS
         ▼
┌──────────────────────────────────────┐
│  Frontend (Next.js) - Vercel         │
│  ├─ App Router (/login, /dashboard)  │
│  ├─ React Components & Hooks          │
│  ├─ React Query (server state)        │
│  └─ Tailwind CSS Styling              │
└────────┬─────────────────────────────┘
         │ HTTPS API Requests
         │ Credentials: Include
         ▼
┌──────────────────────────────────────┐
│  Backend (Express) - Render           │
│  ├─ Routes & Controllers              │
│  ├─ Middleware (auth, CORS, CSRF)     │
│  ├─ Services (business logic)         │
│  ├─ Prisma (ORM)                      │
│  └─ Redis (rate limiting, jobs)       │
└────────┬─────────────────────────────┘
         │ SQL
         │ ioredis
         ▼
┌──────────────────────────────────────┐
│  Data Layer                           │
│  ├─ PostgreSQL (Supabase)             │
│  └─ Redis (Render)                    │
└──────────────────────────────────────┘
```

---

## Features

### Platform Administrator

- Manage all organizations on the platform
- Create and configure new organizations
- Assign organization administrators
- View platform-wide analytics and audit logs
- Monitor system health and performance

### Organization Administrator

- Manage users within the organization
- Create instructor and student accounts
- Assign roles and organization membership
- View organization-level analytics
- Monitor course creation and student enrollment
- Access audit logs for compliance

### Instructor

- Create and manage courses
  - Organize content into modules and lessons
  - Support multimedia content (video, documents, images)
  - Define learning objectives
- Create interactive quizzes
  - Add multiple-choice questions
  - Set passing scores and attempt limits
  - Configure time limits per quiz
- Manage student enrollment
- View student progress and quiz scores
- Generate certificates for course completion
- Access course-level analytics

### Student

- Browse available courses in organization
- Enroll in courses
- Complete lesson modules at own pace
- Take quizzes and receive immediate feedback
- Track learning progress
- View completed and in-progress courses
- Generate and download certificates upon completion
- Access email verification and password reset

### Core Features

#### Course Management
- Course creation with drafts and publishing workflow
- Courses organized into modules and lessons
- Support for different lesson types (text, video, document)
- Course preview for students before enrollment
- Thumbnail images for visual identification

#### Learning Content
- Modular course structure
- Sequenced lessons within modules
- Lesson preview mode for public/sample content
- Resource attachments (documents, media files)
- Duration tracking per lesson

#### Assessment Engine
- Quiz creation with multiple-choice questions
- Configurable passing scores and attempt limits
- Time-limited quiz attempts
- Automatic scoring and result calculation
- Quiz attempt history and analytics

#### Enrollment Management
- Student enrollment in courses
- Enrollment status tracking (active, completed, dropped)
- Bulk student import (organizational feature)
- Enrollment analytics and reporting

#### Progress Tracking
- Lesson completion tracking
- Module-level progress aggregation
- Course completion percentage
- Last visited tracking for resume functionality
- Quiz attempt history with scores

#### Certificates
- Automatic certificate generation upon course completion
- Unique certificate IDs for verification
- PDF download capability
- Public certificate verification endpoint (no authentication required)
- Certificate metadata (student name, course title, completion date)

#### Notifications
- Welcome notifications for new users
- Enrollment confirmations
- Course completion notifications
- Certificate generation notifications
- Password reset notifications
- Course publication notifications

#### Audit Logging
- Platform-wide audit trail (platform admin only)
- Organization-level audit logs (org admin only)
- Action tracking with actor details
- Resource change tracking
- Timestamp and IP address recording

#### Search & Discovery
- Course search functionality
- Category-based course filtering
- Course difficulty levels
- Learning objectives display

#### Commerce (Foundation)
- Course pricing support
- Order management system
- Payment processing foundation (mock provider)
- Discount pricing support

---

## Role-Based Access Control

LearnFlow implements a hierarchical role-based access control (RBAC) system with four distinct roles:

| Role | Level | Scope | Capabilities |
|------|-------|-------|--------------|
| **PLATFORM_ADMIN** | 4 | System-wide | Manage all organizations, view platform analytics, system configuration |
| **ORG_ADMIN** | 3 | Organization | Manage organization users, courses, view organization analytics |
| **INSTRUCTOR** | 2 | Organization | Create/manage courses, quizzes, manage student enrollment |
| **STUDENT** | 1 | Organization | Enroll in courses, complete lessons, take quizzes |

### Key RBAC Principles

1. **Role Hierarchy:** Higher-level roles inherit permissions of lower levels
2. **Per-Organization Membership:** Users can have different roles in different organizations
3. **Primary Role:** When a user belongs to multiple organizations, their primary role is determined by priority (PLATFORM_ADMIN > ORG_ADMIN > INSTRUCTOR > STUDENT)
4. **Server-Side Authorization:** All authorization checks are performed on the backend; client-side role checks are advisory only
5. **Organization Context:** Protected endpoints require both authentication and organization membership validation

### Multi-Tenancy & Data Isolation

**Organization Isolation:**
- Each organization has completely isolated data
- Organization A's courses cannot be accessed by Organization B's users
- User lists are filtered per organization
- All queries include organization ID filters

**Authorization Validation:**
- Organization membership is verified via `UserOrganization` lookup
- Platform admins can access any organization
- Non-admin users must have explicit membership
- Direct manipulation of organization IDs in requests is rejected

**Example:** Organization A's instructor cannot access Organization B's student progress, even with valid authentication and a modified organization ID in the request.

---

## Authentication Flow

### Registration & Onboarding

```
1. User visits /register
2. Submits email, password, name
3. POST /api/v1/auth/register
   ├─ Validate input (email format, password strength)
   ├─ Hash password with Argon2
   ├─ Create User record (emailVerified: false)
   ├─ Create session cookie
   └─ Return session
4. User redirected to /welcome
5. Email verification link sent
6. User clicks email link or resends via /api/v1/auth/verify-email
7. POST /api/v1/auth/resend-verification (rate-limited)
8. User verifies email
9. Full account access granted
```

### Login Flow

```
1. User visits /login
2. Submits email and password
3. POST /api/v1/auth/login
   ├─ Fetch user by email
   ├─ Verify password against hash
   ├─ Validate email is verified
   ├─ Create session (stored in database)
   ├─ Set session cookie (HttpOnly, Secure in prod)
   └─ Return user profile
4. GET /api/v1/auth/me (fetch authenticated user)
5. Determine user's role and primary organization
6. Redirect to role-based dashboard
   ├─ PLATFORM_ADMIN → /dashboard
   ├─ ORG_ADMIN → /dashboard/organization
   ├─ INSTRUCTOR → /dashboard/instructor
   └─ STUDENT → /dashboard/student/search
```

### Session Management

**Session Cookie Configuration:**

| Setting | Development | Production |
|---------|------------|-----------|
| Name | `learnflow_session` | `learnflow_session` |
| HttpOnly | ✓ Yes | ✓ Yes |
| Secure | ✗ No (localhost) | ✓ Yes (HTTPS only) |
| SameSite | Lax (localhost) | None (cross-origin) |
| Max Age | 7 days (604800s) | 7 days (604800s) |

**Development Mode** (SESSION_COOKIE_SECURE=false):
- Cookies only sent over HTTP
- Works with localhost
- SameSite=Lax (same-site requests only)

**Production Mode** (SESSION_COOKIE_SECURE=true):
- Cookies only sent over HTTPS
- Includes `Secure` flag
- SameSite=None (allows cross-origin)
- Required for Vercel frontend → Render backend communication

### Password Reset Flow

```
1. User visits /forgot-password
2. Submits email address
3. POST /api/v1/auth/forgot-password
   ├─ Find user by email
   ├─ Generate time-limited reset token
   ├─ Send reset link via email
   └─ Return success
4. User clicks email link and visits /reset-password?token=...
5. Submits new password
6. POST /api/v1/auth/reset-password
   ├─ Validate reset token (not expired, not used)
   ├─ Hash new password
   ├─ Mark token as used
   └─ Return success
7. User can now login with new password
```

### Authenticated API Requests

**Flow:**
```
1. Client has valid session cookie (set during login)
2. Browser automatically includes cookie in requests
3. Backend middleware:
   GET /api/v1/auth/me
   ├─ Extract session cookie
   ├─ Lookup session in database
   ├─ Fetch user details
   ├─ Resolve user's primary role and organization
   └─ Attach user context to request
4. Controller/middleware validates authorization
5. Request proceeds or returns 403 (insufficient permissions)
```

**CORS & Credentials:**
- Frontend uses `credentials: 'include'` in fetch requests
- Backend allows requests from allowlisted origins
- Cookies are sent and received with each request

### Logout

```
1. User clicks logout button
2. POST /api/v1/auth/logout
   ├─ Extract session cookie
   ├─ Mark session as revoked in database
   └─ Return success
3. Frontend clears local state
4. User redirected to /login
5. Session cookie becomes invalid
```

---

## Multi-Tenancy & Data Isolation

### Isolation Strategy

**Organization-Scoped Queries:**

Every sensitive query includes organization ID filtering:

```typescript
// Example: Get courses for an organization
const courses = await prisma.course.findMany({
  where: {
    organizationId: req.organizationId,  // ← Mandatory filter
    instructorUserId: req.userId,
  },
});
```

**User Membership Validation:**

Before accessing organization resources:

```typescript
const membership = await prisma.userOrganization.findUnique({
  where: {
    userId_organizationId: {
      userId: req.userId,
      organizationId: req.organizationId,
    },
  },
});

if (!membership) {
  return res.status(403).json({ error: 'ORGANIZATION_ACCESS_DENIED' });
}
```

**Platform Admin Override:**

Platform admins can access any organization without membership:

```typescript
const isPlatformAdmin = await prisma.userOrganization.findFirst({
  where: {
    userId: req.userId,
    role: 'PLATFORM_ADMIN',
  },
});

if (isPlatformAdmin) {
  // Grant access to requested organization
}
```

### Security Boundary

**What is NOT allowed:**
- Student A viewing Student B's progress in a different organization
- Instructor A managing Instructor B's courses in a different organization
- Org Admin A accessing Organization B's analytics
- Direct manipulation of organizationId in URL/body to bypass isolation

**What IS allowed:**
- Platform admins viewing any organization's data
- Users within the same organization collaborating according to their roles
- Cross-organization operations only if explicitly granted (e.g., platform admin to admin migration)

---

## API Documentation

### Base URL
- **Development:** `http://localhost:4000/api/v1`
- **Production:** `https://learn-flow-1-1gl3.onrender.com/api/v1`

### Authentication
All protected endpoints require:
1. Valid session cookie (set during login)
2. Email verification (for feature endpoints)
3. Organization context (for organization-scoped endpoints)

### Authentication Routes

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| POST | `/auth/register` | User registration | ✗ | - |
| POST | `/auth/login` | Login with email/password | ✗ | - |
| POST | `/auth/logout` | Logout and revoke session | ✓ | Any |
| GET | `/auth/me` | Get current user profile | ✓ | Any |
| PATCH | `/auth/me` | Update email address | ✓ | Any |
| PATCH | `/auth/password` | Change password | ✓ | Any |
| POST | `/auth/forgot-password` | Request password reset | ✗ | - |
| POST | `/auth/reset-password` | Complete password reset | ✗ | - |
| POST | `/auth/verify-email` | Verify email with token | ✗ | - |
| POST | `/auth/resend-verification` | Resend verification email (rate-limited) | ✓ | Any |

### Platform Admin Routes

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/admin/dashboard` | Platform admin dashboard | ✓ | PLATFORM_ADMIN |
| GET | `/organizations` | List all organizations | ✓ | PLATFORM_ADMIN |
| POST | `/organizations` | Create organization | ✓ | PLATFORM_ADMIN |
| GET | `/organizations/:id` | Get organization details | ✓ | PLATFORM_ADMIN |
| GET | `/organizations/:id/members` | List organization members | ✓ | PLATFORM_ADMIN |
| PATCH | `/organizations/:id` | Update organization | ✓ | PLATFORM_ADMIN |
| PATCH | `/organizations/:id/status` | Update organization status | ✓ | PLATFORM_ADMIN |
| POST | `/organizations/:id/admins` | Assign admin to organization | ✓ | PLATFORM_ADMIN |

### Organization Admin Routes

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/org/dashboard` | Organization dashboard | ✓ | ORG_ADMIN |
| GET | `/org/analytics` | Organization analytics | ✓ | ORG_ADMIN |
| GET | `/org/organization` | Get organization details | ✓ | ORG_ADMIN |
| GET | `/org/users` | List organization users | ✓ | ORG_ADMIN |
| GET | `/org/users/:userId` | Get user details | ✓ | ORG_ADMIN |
| POST | `/org/instructors` | Create instructor account | ✓ | ORG_ADMIN |
| POST | `/org/students` | Create student account | ✓ | ORG_ADMIN |
| PATCH | `/org/users/:userId` | Update user details | ✓ | ORG_ADMIN |

### Category Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/org/categories` | List categories | ✓ | ORG_ADMIN | ✓ |
| POST | `/org/categories` | Create category | ✓ | ORG_ADMIN | ✓ |
| PATCH | `/org/categories/:categoryId` | Update category | ✓ | ORG_ADMIN | ✓ |
| DELETE | `/org/categories/:categoryId` | Delete category | ✓ | ORG_ADMIN | ✓ |

### Course Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/courses` | List courses | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| POST | `/organizations/:orgId/courses` | Create course | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| GET | `/organizations/:orgId/courses/:courseId` | Get course | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId` | Update course | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId/status` | Update course status | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId/thumbnail` | Upload course thumbnail | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |

### Module Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/courses/:courseId/modules` | List modules | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| POST | `/organizations/:orgId/courses/:courseId/modules` | Create module | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId` | Get module | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId/modules/:moduleId` | Update module | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| DELETE | `/organizations/:orgId/courses/:courseId/modules/:moduleId` | Delete module | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |

### Lesson Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons` | List lessons | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| POST | `/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons` | Create lesson | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Get lesson | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Update lesson | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |
| DELETE | `/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Delete lesson | ✓ | ORG_ADMIN/INSTRUCTOR | ✓ |

### Quiz Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes` | List quizzes | ✓ | INSTRUCTOR | ✓ |
| POST | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes` | Create quiz | ✓ | INSTRUCTOR | ✓ |
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes/:quizId` | Get quiz | ✓ | INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes/:quizId` | Update quiz | ✓ | INSTRUCTOR | ✓ |
| DELETE | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes/:quizId` | Delete quiz | ✓ | INSTRUCTOR | ✓ |

### Question Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions` | List questions | ✓ | INSTRUCTOR | ✓ |
| POST | `/organizations/:orgId/courses/:courseId/modules/:moduleId/quizzes/:quizId/questions` | Create question | ✓ | INSTRUCTOR | ✓ |
| GET | `/organizations/:orgId/.../questions/:questionId` | Get question | ✓ | INSTRUCTOR | ✓ |
| PATCH | `/organizations/:orgId/.../questions/:questionId` | Update question | ✓ | INSTRUCTOR | ✓ |
| DELETE | `/organizations/:orgId/.../questions/:questionId` | Delete question | ✓ | INSTRUCTOR | ✓ |

### Enrollment Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| POST | `/organizations/:orgId/enrollments/:courseId` | Enroll in course | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/enrollments` | List enrollments | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/enrollments/:courseId` | Get enrollment | ✓ | STUDENT | ✓ |
| DELETE | `/organizations/:orgId/enrollments/:courseId` | Unenroll from course | ✓ | STUDENT | ✓ |

### Student Learning Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/student/courses` | List enrolled courses | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/stats` | Get student statistics | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/courses/:courseId/overview` | Get course overview | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Get lesson content | ✓ | STUDENT | ✓ |
| POST | `/organizations/:orgId/student/courses/:courseId/modules/:moduleId/quizzes/:quizId/attempts` | Submit quiz | ✓ | STUDENT | ✓ |

### Progress Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/student/courses/:courseId/progress` | Get course progress | ✓ | STUDENT | ✓ |
| POST | `/organizations/:orgId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId/progress` | Mark lesson complete | ✓ | STUDENT | ✓ |

### Certificate Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| POST | `/organizations/:orgId/student/courses/:courseId/certificate` | Generate certificate | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/certificates` | List certificates | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/certificates/:certId` | Get certificate | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/certificates/:certId/download` | Download certificate PDF | ✓ | STUDENT | ✓ |
| GET | `/certificates/verify/:token` | Verify certificate (public) | ✗ | - | - |

### Notification Routes

| Method | Endpoint | Purpose | Auth | Role | Org Context |
|--------|----------|---------|------|------|-------------|
| GET | `/organizations/:orgId/student/notifications` | List notifications | ✓ | STUDENT | ✓ |
| GET | `/organizations/:orgId/student/notifications/unread-count` | Get unread count | ✓ | STUDENT | ✓ |
| POST | `/organizations/:orgId/student/notifications/read-all` | Mark all as read | ✓ | STUDENT | ✓ |
| POST | `/organizations/:orgId/student/notifications/:notId/read` | Mark as read | ✓ | STUDENT | ✓ |

### Health & Status Routes

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/health` | Service health (always 200) | ✗ |
| GET | `/api/health` | Detailed health with dependencies | ✗ |
| GET | `/api/ready` | Readiness probe (503 if unavailable) | ✗ |

### Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE"
}
```

**Common Error Codes:**

| Code | Status | Meaning |
|------|--------|---------|
| `NOT_AUTHENTICATED` | 401 | No valid session |
| `SESSION_INVALID` | 401 | Session expired or revoked |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role does not permit action |
| `ORGANIZATION_ACCESS_DENIED` | 403 | Not a member of organization |
| `ORGANIZATION_REQUIRED` | 400 | Organization context missing |
| `CSRF_ORIGIN_REJECTED` | 403 | Request origin not allowed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests (see Retry-After header) |
| `INVALID_JSON` | 400 | Malformed JSON request |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds limit |
| `SERVER_ERROR` | 500 | Unexpected server error |

---

## Environment Variables

### Development Setup

```bash
# Database
DATABASE_URL=postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Email (SMTP for development)
MAIL_SMTP_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_FROM=no-reply@learnflow.local

# App URL
APP_URL=http://localhost:3000

# Session
SESSION_COOKIE_NAME=learnflow_session
SESSION_COOKIE_SECURE=false
SESSION_TTL_SECONDS=604800

# Admin Seed (local development only)
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin123

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=masterKey
```

### Production Setup

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✓ | PostgreSQL connection | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL` | ✓ | Redis connection | `redis://host:6379` |
| `NODE_ENV` | ✓ | Environment mode | `production` |
| `SESSION_COOKIE_SECURE` | ✓ | Enable secure cookies | `true` |
| `SESSION_COOKIE_NAME` | ✗ | Cookie name | `learnflow_session` (default) |
| `SESSION_TTL_SECONDS` | ✗ | Session duration | `604800` (7 days, default) |
| `CORS_ALLOWED_ORIGINS` | ✓ | Allowed frontend origins | `https://learn-flow-web-indol.vercel.app` |
| `APP_URL` | ✓ | Frontend URL for email links | `https://learn-flow-web-indol.vercel.app` |
| `MAIL_SMTP_HOST` | ✓ | SMTP server | `smtp.gmail.com` |
| `MAIL_SMTP_PORT` | ✓ | SMTP port | `587` |
| `MAIL_FROM` | ✓ | Email sender address | `no-reply@learnflow.app` |
| `CLOUDINARY_CLOUD_NAME` | ✓ | Cloudinary account name | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | ✓ | Cloudinary API key | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | ✓ | Cloudinary API secret | From Cloudinary dashboard |
| `API_RATE_LIMIT_WINDOW_MS` | ✗ | Rate limit window | `60000` (1 minute, default) |
| `API_RATE_LIMIT_MAX` | ✗ | Requests per window | `300` (default) |

**Note:** Do NOT commit `.env` files with real secrets. Use a secure secret manager (AWS Secrets Manager, Render environment variables, etc.) in production.

---

## Local Development Setup

### Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **PostgreSQL** 14+
- **Redis** 6+
- **Git**

Optional for Docker approach:
- **Docker** and **Docker Compose**

### Option 1: Native Setup (Recommended for Development)

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/learnflow.git
cd learn-flow
```

#### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for both frontend and backend due to monorepo workspace configuration.

#### 3. Setup Database

```bash
# Create PostgreSQL database (if not exists)
createdb learnflow_db

# Run Prisma migrations
npx prisma migrate deploy

# Seed database with demo data
npx prisma db seed
```

#### 4. Setup Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL=postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `APP_URL=http://localhost:3000`
- `SESSION_COOKIE_SECURE=false` (local development)
- Cloudinary credentials (get from https://cloudinary.com/console)

#### 5. Start Services

**Terminal 1 - Backend (API):**
```bash
cd apps/api
npm run dev
# Listens on http://localhost:4000
```

**Terminal 2 - Frontend (Web):**
```bash
cd apps/web
npm run dev
# Listens on http://localhost:3000
```

Visit: http://localhost:3000

#### 6. Login with Demo Credentials

- **Email:** admin@gmail.com
- **Password:** admin123

### Option 2: Docker Compose Setup

```bash
docker-compose up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Mailpit (port 1025, SMTP testing)
- Frontend (port 3000)
- Backend (port 4000)

### Build & TypeCheck

```bash
# Build all workspaces
npm run build

# Lint all workspaces
npm run lint

# Run tests
npm run test

# Test coverage
npm run test:coverage
```

---

## Database

### Technology

- **Production:** PostgreSQL (Supabase)
- **Development:** PostgreSQL (local or Docker)
- **ORM:** Prisma

### Migrations

Prisma tracks all schema changes via migrations in `apps/api/prisma/migrations/`:

**Current Migrations (16 total):**
1. `20260821_init` - Initial schema
2. `20260822_rbac` - Role-based access control
3. `20260822_rbac_organization_status` - Organization status
4. `20260825_course_model` - Course structure
5. `20260826_module_lesson` - Modules and lessons
6. `20260827_enrollment` - Student enrollment
7. `20260827_quiz_engine` - Quiz and questions
8. `20260828_certificate` - Certificate system
9. `20260828_commerce` - Payment and orders
10. `20260828_file_storage` - Media storage
11. `20260828_notifications` - Notification system
12. `20260828_progress` - Learning progress tracking
13. `20260829_audit_log` - Audit logging
14. `20260829_categories` - Course categories
15. `20260831_add_audit_log_actor_name` - Audit log enhancements

### Schema Highlights

**Core Tables:**
- `users` - User accounts
- `organizations` - Multi-tenant organizations
- `userOrganization` - User membership per organization
- `courses` - Course definitions
- `modules` - Course modules
- `lessons` - Lesson content
- `quizzes` - Quiz definitions
- `questions` - Quiz questions
- `enrollments` - Student enrollment records
- `certificates` - Certificate records
- `auditLogs` - Audit trail

### Running Migrations

**Deploy migrations:**
```bash
npx prisma migrate deploy
```

**Create new migration:**
```bash
npx prisma migrate dev --name add_feature_name
```

**View schema:**
```bash
npx prisma studio  # Opens visual editor
```

---

## Deployment

### Frontend Deployment (Vercel)

**Current:** https://learn-flow-web-indol.vercel.app

**Deployment Steps:**

1. Connect GitHub repository to Vercel
2. Set environment variable: `NEXT_PUBLIC_API_URL=https://learn-flow-1-1gl3.onrender.com`
3. Vercel automatically builds and deploys on `main` branch push

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm start
```

### Backend Deployment (Render)

**Current:** https://learn-flow-1-1gl3.onrender.com

**Deployment Steps:**

1. Create Render account and new Web Service
2. Connect GitHub repository
3. Set environment variables:
   - `NODE_ENV=production`
   - `SESSION_COOKIE_SECURE=true`
   - `DATABASE_URL=<supabase-postgresql-url>`
   - `REDIS_URL=<render-redis-url>`
   - `CORS_ALLOWED_ORIGINS=https://learn-flow-web-indol.vercel.app`
   - `CLOUDINARY_*` variables
   - `MAIL_SMTP_*` variables

4. Set build command:
```bash
npm run build
```

5. Set start command:
```bash
npm --prefix ./apps/api start
```

6. Add PostgreSQL add-on (or use external Supabase)
7. Add Redis add-on (or use external Redis)

**Health Check:** `GET /api/ready`

### Database Deployment (Supabase)

1. Create Supabase project
2. Get PostgreSQL connection string
3. Set `DATABASE_URL` in Render environment
4. Run migrations:
```bash
npx prisma migrate deploy
```

### Redis Deployment (Render or External)

Render provides managed Redis, or use external provider:
- Redis Cloud
- AWS ElastiCache
- Upstash

Set `REDIS_URL` in environment variables.

### Production Architecture

```
https://learn-flow-web-indol.vercel.app
         ↓ HTTPS API calls
https://learn-flow-1-1gl3.onrender.com
         ↓ SQL
Supabase PostgreSQL
         ↓ ioredis
Render Redis
```

---

## Project Structure

```
learn-flow/
├── apps/
│   ├── api/                          # Backend (Node.js/Express)
│   │   ├── src/
│   │   │   ├── config/               # Configuration (origins, CORS)
│   │   │   ├── controllers/          # HTTP handlers (18 files by feature)
│   │   │   ├── middleware/           # Express middleware
│   │   │   │   ├── auth.ts           # Authentication & authorization
│   │   │   │   ├── security.ts       # Security headers
│   │   │   │   ├── csrf.ts           # CSRF protection
│   │   │   │   └── rateLimit.ts      # Rate limiting
│   │   │   ├── routes/               # Route definitions (18 files)
│   │   │   ├── services/             # Business logic (23 services)
│   │   │   ├── utils/                # Utilities (Redis, helpers)
│   │   │   ├── queues/               # Background jobs (BullMQ)
│   │   │   ├── storage/              # Cloudinary integration
│   │   │   ├── server.ts             # Express app setup
│   │   │   ├── prisma.ts             # Prisma singleton
│   │   │   └── __tests__/            # Unit tests
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   ├── migrations/           # Database migrations (16+)
│   │   │   └── seed.js               # Seed data
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── web/                          # Frontend (Next.js/React)
│       ├── src/
│       │   ├── app/                  # App Router pages
│       │   │   ├── (auth)/           # Login/Register pages
│       │   │   ├── dashboard/        # Role-based dashboards
│       │   │   ├── welcome/          # Welcome page
│       │   │   └── api/              # API routes
│       │   ├── components/           # React components
│       │   │   ├── layout/           # Layouts
│       │   │   ├── auth/             # Auth components
│       │   │   ├── ui/               # Reusable UI components
│       │   │   └── forms/            # Form components
│       │   ├── features/             # Feature-specific logic
│       │   │   └── auth/
│       │   │       ├── useCurrentUser.ts  # Auth hook
│       │   │       └── postLoginRedirect.ts
│       │   ├── lib/                  # Utilities
│       │   │   ├── api.ts            # API client
│       │   │   └── hooks/            # Custom hooks
│       │   └── styles/               # Global styles
│       ├── public/                   # Static assets
│       ├── package.json
│       ├── tsconfig.json
│       └── tailwind.config.js
│
├── packages/
│   └── validation/                   # Shared validation package
│
├── docs/                             # Documentation
├── .env.example                      # Environment template
├── docker-compose.yml                # Docker Compose setup
├── package.json                      # Root workspace config
└── README.md                         # This file
```

---

## Frontend Architecture

### Technology Stack

- **Next.js 16.3.1** - React framework with App Router
- **React 19.2.8** - UI library
- **TypeScript 5** - Static typing
- **React Query 5** - Server state management
- **Tailwind CSS 3** - Utility-first styling
- **Playwright** - E2E testing

### Directory Structure

```
apps/web/src/
├── app/                       # Next.js App Router
│   ├── (auth)/               # Auth layout group
│   │   ├── login/            # Login page
│   │   └── register/         # Register page
│   ├── dashboard/            # Role-based dashboards
│   │   ├── page.tsx          # Root dashboard
│   │   ├── organization/     # Org admin dashboard
│   │   ├── instructor/       # Instructor dashboard
│   │   └── student/          # Student dashboard
│   ├── welcome/              # Welcome page after signup
│   ├── layout.tsx            # Root layout
│   └── api/                  # Next.js API routes
│
├── components/               # React components
│   ├── layout/              # Layout components
│   │   └── DashboardLayout.tsx
│   ├── auth/                # Auth-specific components
│   │   ├── AuthSwitch.tsx   # Login/Register toggle
│   │   └── LoginForm.tsx
│   ├── ui/                  # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Alert.tsx
│   │   └── Spinner.tsx
│   └── forms/               # Form components
│
├── features/                # Feature-specific logic
│   └── auth/
│       ├── useCurrentUser.ts        # Fetch current user
│       └── postLoginRedirect.ts     # Determine post-login redirect
│
├── lib/                     # Utilities
│   ├── api.ts              # Fetch wrapper with credentials
│   └── hooks/              # Custom React hooks
│
└── styles/                 # Global Tailwind CSS
    └── globals.css
```

### Key Features

**Authentication Flow:**
1. `useCurrentUser()` hook fetches `/api/v1/auth/me`
2. Session cookie included automatically via `credentials: 'include'`
3. On login, redirect logic determines dashboard based on role
4. Protected pages render `null` while checking auth to prevent flash

**API Communication:**
```typescript
// apps/web/src/lib/api.ts
const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

// All requests include credentials
await fetch(`${apiBase}/api/v1/auth/me`, {
  credentials: 'include',  // ← Include session cookie
  headers: { 'Content-Type': 'application/json' }
});
```

**Role-Based Routing:**
- Login page checks `user.role`
- `getPostLoginRedirect()` returns appropriate dashboard URL
- Students → `/dashboard/student/search`
- Instructors → `/dashboard/instructor`
- Org Admins → `/dashboard/organization`
- Platform Admins → `/dashboard`

**Loading States:**
- Components use React Query `isLoading` state
- Custom `PageLoader` component for full-page loading
- Skeleton screens for list items during fetch

---

## Backend Architecture

### Technology Stack

- **Express 4.18** - Web framework
- **TypeScript 5** - Static typing
- **Prisma 4.16** - ORM
- **PostgreSQL** - Database
- **Redis** - Caching and rate limiting
- **BullMQ** - Job queue

### Request Processing Flow

```
Incoming Request
    ↓
Security Headers Middleware
    ↓
CORS Check
    ↓
CSRF Origin Check (for state-changing requests)
    ↓
Cookie Parser
    ↓
Rate Limiter (Redis-backed)
    ↓
Route Matching
    ↓
Authentication Middleware (requireAuth)
    ├─ Extract session cookie
    ├─ Validate against database
    └─ Load user context
    ↓
Email Verification Check (if required)
    ↓
Organization Context Middleware
    ├─ Validate organization membership
    └─ Set req.organizationId
    ↓
Role-Based Authorization
    ├─ Check role permissions
    └─ Enforce RBAC
    ↓
Controller Handler
    ├─ Validate input
    ├─ Call service layer
    └─ Return response
    ↓
Response Sent to Client
```

### Service Layer Architecture

```
Controller
    ↓ (calls)
Service
    ├─ Business logic
    ├─ Validation
    ├─ Authorization
    └─ Data orchestration
    ↓ (calls)
Prisma Client
    ↓ (SQL queries)
PostgreSQL
```

**Example:** Creating a course

```typescript
// routes/courseRoutes.ts
router.post('/:organizationId/courses', 
  requireAuth, 
  requireVerifiedEmail,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  courseController.createCourse
);

// controllers/courseController.ts
export async function createCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const course = await courseService.createCourse({
      organizationId: req.organizationId!,
      instructorUserId: req.userId!,
      data: req.body
    });
    res.json({ success: true, course });
  } catch (err) {
    handleError(err, res);
  }
}

// services/courseService.ts
export async function createCourse(input: CreateCourseInput) {
  // Validate input
  validateCourseData(input.data);
  
  // Create in database
  return prisma.course.create({
    data: {
      organizationId: input.organizationId,
      instructorUserId: input.instructorUserId,
      title: input.data.title,
      // ...
    }
  });
}
```

### Database Access Patterns

**Single Record by ID:**
```typescript
const course = await prisma.course.findUnique({
  where: { id: courseId }
});
```

**Organization-Scoped Queries:**
```typescript
const courses = await prisma.course.findMany({
  where: {
    organizationId: req.organizationId,  // ← Always filter
    instructorUserId: req.userId
  }
});
```

**Relationships:**
```typescript
const course = await prisma.course.findUnique({
  where: { id: courseId },
  include: {
    modules: true,
    enrollments: true,
    instructor: true
  }
});
```

### Error Handling

**Global Error Handler:**
```typescript
app.use((err: unknown, req: Request, res: Response) => {
  if (res.headersSent) return next(err);
  
  if (err instanceof PrismaClientKnownRequestError) {
    return res.status(400).json({ 
      success: false, 
      error: 'DATABASE_ERROR' 
    });
  }
  
  return res.status(500).json({ 
    success: false, 
    error: 'SERVER_ERROR' 
  });
});
```

### Background Jobs

**Notification Queue (BullMQ):**
```typescript
// jobs/notificationWorker.ts
const notificationQueue = new Queue('notifications', {
  connection: redisConnection
});

notificationQueue.process(async (job) => {
  await sendNotificationEmail(job.data);
});
```

---

## User Journey

### New User Onboarding

```
1. Visit http://localhost:3000
2. Click "Sign Up" → /register
3. Enter email, password, full name
4. Submit registration
   ├─ Backend validates input
   ├─ Checks email uniqueness
   ├─ Hashes password (Argon2)
   ├─ Creates User record (emailVerified: false)
   ├─ Creates session cookie
   └─ Sends verification email
5. Redirected to /welcome with account details
6. Email verification required
   ├─ Click email link or resend from /welcome
   └─ POST /api/v1/auth/verify-email
7. Account now active

Workflow: Register → Welcome → Email Verification → Login → Dashboard
```

### Student Learning Journey

```
1. Authenticated Student at /dashboard/student/search
2. Browse available courses
3. Enroll in course
   ├─ POST /api/v1/organizations/:orgId/enrollments/:courseId
   └─ Enrollment record created
4. View course overview
5. Start learning
   ├─ Module 1 → Lesson 1
   ├─ Complete lesson → mark progress
   ├─ Lesson 2
   ├─ Module 2 Quiz
   │   ├─ Answer questions
   │   ├─ Submit
   │   └─ View score
   └─ Continue through course
6. Complete all modules
7. Course marked complete
8. Generate Certificate
   ├─ POST /api/v1/organizations/:orgId/student/courses/:courseId/certificate
   ├─ PDF generated
   ├─ Unique token created
   └─ Email sent with download link
9. Access certificates at /dashboard/student/certificates
```

### Instructor Course Creation

```
1. Instructor at /dashboard/instructor
2. Click "Create Course"
3. Fill course metadata
   ├─ Title, description, category
   ├─ Learning objectives
   ├─ Upload thumbnail
   └─ Save as Draft
4. Add Module 1
5. Add Lessons to Module
   ├─ Lesson title, content
   ├─ Upload resources
   └─ Save
6. Add Quiz to Module
   ├─ Create questions
   ├─ Set passing score (e.g., 70%)
   └─ Configure attempt limits
7. Review course structure
8. Publish course
   ├─ Status changes from DRAFT → PUBLISHED
   ├─ Notification sent
   └─ Available for student enrollment
9. Monitor student progress
   ├─ View enrollments
   ├─ Check quiz scores
   └─ Export analytics
```

---

## Security

### Authentication & Authorization

- **Password Hashing:** Argon2 (OWASP-recommended)
- **Session Management:** HTTP-only cookies with Secure flag in production
- **Email Verification:** Token-based verification on signup
- **Password Reset:** Time-limited, single-use reset tokens
- **Session Revocation:** Sessions marked as revoked on logout

### Transport Security

- **HTTPS Only:** All production traffic encrypted
- **Secure Cookies:** SameSite=None in cross-origin deployments
- **CORS:** Allowlist-based origin validation
- **CSRF Protection:** Origin header validation for state-changing requests

### Data Protection

- **Organization Isolation:** All queries include organization ID filters
- **Role-Based Access Control:** Server-side enforcement with role hierarchy
- **Authorization Checks:** Membership validation before resource access
- **SQL Injection Protection:** Parameterized queries via Prisma

### Infrastructure Security

- **Security Headers:**
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Content-Security-Policy: restrictive defaults
  - Strict-Transport-Security: HSTS enabled

- **Rate Limiting:** 300 requests per minute per IP/method/path
- **Input Validation:** JSON size limits (1MB), file upload limits (25MB)
- **Error Messages:** Generic error responses (no sensitive details leaked)

### Audit & Compliance

- **Audit Logging:** All admin actions logged with actor, timestamp, and IP
- **Data Integrity:** Timestamps on all records (createdAt, updatedAt)
- **Soft Deletes:** Organization status tracking (ACTIVE, SUSPENDED)
- **Access Logs:** Rate limiting tracks request patterns

---

## Troubleshooting

### Frontend Cannot Reach API

**Symptom:** "Failed to fetch" or CORS errors in browser console

**Diagnosis:**
1. Verify `NEXT_PUBLIC_API_URL` matches backend URL
2. Check backend is running and accessible
3. Verify backend CORS configuration

**Solution:**
```bash
# Development:
NEXT_PUBLIC_API_URL=http://localhost:4000

# Production:
NEXT_PUBLIC_API_URL=https://learn-flow-1-1gl3.onrender.com
```

### CORS Errors in Production

**Symptom:** Browser blocks requests with CORS error

**Cause:** Frontend origin not in backend's allowed origins list

**Solution:**

Set `CORS_ALLOWED_ORIGINS` in backend environment:
```
CORS_ALLOWED_ORIGINS=https://learn-flow-web-indol.vercel.app
```

### Authentication Failed / Session Invalid

**Symptom:** 401 "NOT_AUTHENTICATED" or 403 "SESSION_INVALID"

**Causes:**
- Session cookie not being sent
- Session expired or revoked
- Browser has cookies disabled

**Solution:**
```bash
# Verify credentials: include in fetch requests
fetch(url, {
  credentials: 'include'  # ← Essential
})

# Check cookie visibility in DevTools → Application → Cookies
# Verify SESSION_COOKIE_SECURE setting matches environment
```

### Email Verification Not Working

**Symptom:** Verification emails not received or link broken

**Causes:**
- Mailpit not running (local development)
- APP_URL incorrectly configured
- SMTP credentials invalid (production)

**Solution (Development):**
```bash
# Ensure Docker Compose is running
docker-compose up

# Check Mailpit at http://localhost:1025
# Verify APP_URL=http://localhost:3000
```

**Solution (Production):**
- Verify `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_FROM`
- Test SMTP credentials independently
- Check spam folder for emails
- Verify `APP_URL` points to frontend (for email links)

### Database Connection Failed

**Symptom:** "connect ECONNREFUSED" or "database unavailable"

**Causes:**
- PostgreSQL not running
- DATABASE_URL is incorrect
- Database credentials invalid

**Solution:**
```bash
# Local development
postgres://learnflow:learnflow_pass@localhost:5432/learnflow_db

# Verify with psql
psql postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db

# Production: Verify connection string from Supabase dashboard
```

### Redis Connection Error

**Symptom:** "Redis error, failing open" or rate limiting not working

**Causes:**
- Redis not running
- REDIS_URL is incorrect
- Connection refused

**Solution:**
```bash
# Local development
REDIS_URL=redis://localhost:6379

# Test connection
redis-cli -u redis://localhost:6379 ping

# Production: Use Render or external Redis provider
```

### Rate Limiting Returns 429

**Symptom:** Requests blocked with "RATE_LIMIT_EXCEEDED"

**Solution:**
- Wait for window to reset (default: 60 seconds)
- Check `Retry-After` header for exact wait time
- Adjust limits via environment:
  ```
  API_RATE_LIMIT_MAX=600  # 600 requests per window
  API_RATE_LIMIT_WINDOW_MS=60000  # per 60 seconds
  ```

### Certificate Generation Fails

**Symptom:** "Failed to generate certificate" or blank PDFs

**Causes:**
- Cloudinary not configured
- PDFKit missing dependencies
- Course not completed

**Solution:**
- Verify course completion
- Check Cloudinary credentials
- Review certificate service logs

---

## Contributing

(Guidelines for contributing to LearnFlow)

---

## License

(Specify license - MIT, Apache 2.0, etc.)

---

## Support

For issues, feature requests, or questions:
- GitHub Issues: [your-repo]/issues
- Email: support@learnflow.app
- Documentation: [docs-url]

---

**Last Updated:** September 2026  
**Version:** 1.0.0
