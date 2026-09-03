# REST API Documentation

This document provides comprehensive documentation for the LearnFlow REST API, including authentication, endpoints, request/response formats, error handling, and authorization.

## Overview

The LearnFlow API follows RESTful design principles:
- **Base URL**: `http://localhost:4000/api/v1` (development)
- **Protocol**: HTTPS (production)
- **Authentication**: Session-based cookies (httpOnly)
- **Content-Type**: `application/json`
- **Rate Limiting**: Implemented per IP address
- **Response Format**: JSON with `success` and `error` fields

## API Architecture

```
HTTP Request
    ↓
CORS Validation (allowedOrigins check)
    ↓
Rate Limiting (per IP, method, path)
    ↓
Session Middleware (load sessionId from cookie)
    ↓
Authentication Check (if route requires auth)
    ↓
Authorization Check (role-based RBAC)
    ↓
Multi-Tenant Validation (verify organizationId)
    ↓
Route Handler
    ↓
JSON Response
```

## Authentication

### Session-Based Authentication

LearnFlow uses **session-based authentication with httpOnly cookies**:

```
┌─────────────────────────────────┐
│  1. POST /auth/register/login   │ Email + Password
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  2. Verify Credentials          │ Argon2 check
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  3. Create Session              │ Generate token
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  4. Set Cookie Response         │ httpOnly, Secure, SameSite
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  5. Future Requests             │ Cookie sent automatically
└─────────────────────────────────┘
```

### Session Lifetime
- **Duration**: 24 hours
- **Expiration**: Automatic (timestamp stored)
- **Extension**: Session expiration extended on each request
- **Revocation**: Manual logout or password reset
- **Storage**: PostgreSQL (primary) + Redis (cache)

### Session Cookie Properties
```
Name: learnflow_session
HttpOnly: true         // JavaScript cannot access
Secure: true           // HTTPS only (production)
SameSite: Strict       // CSRF protection
Path: /                // Available for entire site
MaxAge: 86400          // 24 hours in seconds
```

### Authentication Headers

Some endpoints support API key authentication (service-to-service):

```
Authorization: Bearer {TOKEN}
```

**Note**: Not currently implemented; use session cookies instead.

## Endpoints

### Authentication Endpoints

#### Register User
```
POST /api/v1/auth/register
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}

Response (200):
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false
  },
  "message": "Registration successful. Check email for verification link."
}

Response (400):
{
  "success": false,
  "error": "INVALID_EMAIL"
}

Response (409):
{
  "success": false,
  "error": "EMAIL_ALREADY_EXISTS"
}

Status Codes:
- 200: Registration successful
- 400: Invalid input (email/password format)
- 409: Email already registered
```

**Email Verification**:
- Verification email sent automatically
- Link expires after 48 hours
- User cannot login until verified (for some flows)
- Rate limit: 3 resend attempts per hour

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response (200):
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true
  }
}

Response (400):
{
  "success": false,
  "error": "INVALID_CREDENTIALS"
}

Response (403):
{
  "success": false,
  "error": "EMAIL_NOT_VERIFIED"
}

Status Codes:
- 200: Login successful, session cookie set
- 400: Invalid email or password
- 403: Email not verified

Side Effects:
- httpOnly session cookie set in response
- Session created in PostgreSQL + Redis
- Login attempt logged in audit log
```

#### Logout
```
POST /api/v1/auth/logout
Authentication: Required (session cookie)

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}

Status Codes:
- 200: Logout successful
- 401: Not authenticated

Side Effects:
- Session revoked in database
- Session cleared from Redis
- Cookie expiration set to immediate
- Logout logged in audit log
```

#### Password Reset Request
```
POST /api/v1/auth/password-reset
Content-Type: application/json

Request Body:
{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "Password reset email sent (if account exists)"
}

Response (200): // Even if email doesn't exist (timing-safe)
{
  "success": true,
  "message": "Password reset email sent (if account exists)"
}

Status Codes:
- 200: Always (timing-safe, no email enumeration)

Rate Limiting:
- 3 requests per hour per email

Side Effects:
- PasswordResetToken created (48 hour expiry)
- Email sent to user (or silently fails if no account)
- No error on missing email (prevents user enumeration)
```

#### Password Reset Confirm
```
POST /api/v1/auth/password-reset-confirm
Content-Type: application/json

Request Body:
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword456!"
}

Response (200):
{
  "success": true,
  "message": "Password reset successful. All sessions revoked."
}

Response (400):
{
  "success": false,
  "error": "INVALID_TOKEN"
}

Response (401):
{
  "success": false,
  "error": "TOKEN_EXPIRED"
}

Status Codes:
- 200: Password reset successful
- 400: Invalid token format
- 401: Token expired or already used

Side Effects:
- Password hashed with new Argon2 salt
- All user sessions revoked (logout from all devices)
- Password reset token marked used
- Password change logged in audit log
```

#### Verify Email
```
POST /api/v1/auth/verify-email
Content-Type: application/json

Request Body:
{
  "token": "verification-token-from-email"
}

Response (200):
{
  "success": true,
  "message": "Email verified successfully"
}

Response (400):
{
  "success": false,
  "error": "INVALID_TOKEN"
}

Response (401):
{
  "success": false,
  "error": "TOKEN_EXPIRED"
}

Status Codes:
- 200: Email verified
- 400: Invalid token
- 401: Token expired
```

#### Current User
```
GET /api/v1/auth/me
Authentication: Required

Response (200):
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "createdAt": "2026-02-01T10:30:00Z",
    "organizations": [
      {
        "id": "org-456",
        "name": "Tech Academy",
        "slug": "tech-academy",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      {
        "id": "org-789",
        "name": "Design School",
        "slug": "design-school",
        "role": "INSTRUCTOR",
        "status": "ACTIVE"
      }
    ]
  }
}

Status Codes:
- 200: User data retrieved
- 401: Not authenticated
```

---

### Organization Endpoints

#### List My Organizations
```
GET /api/v1/organizations
Authentication: Required

Query Parameters:
- limit: number (default: 10)
- offset: number (default: 0)

Response (200):
{
  "success": true,
  "organizations": [
    {
      "id": "org-123",
      "name": "Tech Academy",
      "slug": "tech-academy",
      "status": "ACTIVE",
      "createdAt": "2026-01-15T08:00:00Z",
      "userRole": "ADMIN",
      "memberCount": 42
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}

Status Codes:
- 200: Success
- 401: Not authenticated
```

#### Get Organization
```
GET /api/v1/organizations/:organizationId
Authentication: Required
Authorization: Member of organization

Response (200):
{
  "success": true,
  "organization": {
    "id": "org-123",
    "name": "Tech Academy",
    "slug": "tech-academy",
    "status": "ACTIVE",
    "createdAt": "2026-01-15T08:00:00Z",
    "courseCount": 15,
    "memberCount": 42,
    "userRole": "ADMIN"
  }
}

Status Codes:
- 200: Success
- 401: Not authenticated
- 403: Not a member
- 404: Organization not found
```

#### Update Organization
```
PUT /api/v1/org/:organizationId
Authentication: Required
Authorization: Admin only

Request Body:
{
  "name": "Tech Academy Updated",
  "slug": "tech-academy-2026"
}

Response (200):
{
  "success": true,
  "organization": {
    "id": "org-123",
    "name": "Tech Academy Updated",
    "slug": "tech-academy-2026",
    "updatedAt": "2026-02-01T14:30:00Z"
  }
}

Status Codes:
- 200: Updated successfully
- 401: Not authenticated
- 403: Not admin
- 409: Slug already exists
```

---

### Course Endpoints

#### List Courses
```
GET /api/v1/organizations/:organizationId/courses
Authentication: Optional
Authorization: Published courses visible to all; drafts visible to instructors/admins

Query Parameters:
- status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' (default: PUBLISHED)
- categoryId: string (optional filter)
- instructorId: string (optional filter)
- limit: number (default: 20)
- offset: number (default: 0)
- search: string (full-text search via Meilisearch)
- sortBy: 'createdAt' | 'title' | 'price' (default: createdAt)
- sortOrder: 'asc' | 'desc' (default: desc)

Response (200):
{
  "success": true,
  "courses": [
    {
      "id": "course-123",
      "title": "React Advanced Patterns",
      "slug": "react-advanced-patterns",
      "description": "Learn advanced React patterns...",
      "price": 49.99,
      "discountPrice": 39.99,
      "thumbnailUrl": "https://res.cloudinary.com/.../thumbnail.jpg",
      "status": "PUBLISHED",
      "difficulty": "Advanced",
      "estimatedMinutes": 480,
      "moduleCount": 8,
      "enrollmentCount": 234,
      "rating": 4.8,
      "instructorName": "John Developer",
      "categoryName": "Web Development"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}

Status Codes:
- 200: Success
- 404: Organization not found
```

#### Get Course
```
GET /api/v1/organizations/:organizationId/courses/:courseId
Authentication: Optional
Authorization: Published courses visible to all; drafts visible to instructors/admins

Response (200):
{
  "success": true,
  "course": {
    "id": "course-123",
    "organizationId": "org-456",
    "title": "React Advanced Patterns",
    "slug": "react-advanced-patterns",
    "description": "Learn advanced React patterns and optimization techniques",
    "longDescription": "...",
    "price": 49.99,
    "discountPrice": 39.99,
    "thumbnailUrl": "https://res.cloudinary.com/.../thumbnail.jpg",
    "status": "PUBLISHED",
    "difficulty": "Advanced",
    "learningObjectives": [
      "Master React hooks",
      "Optimize performance",
      "Handle state management"
    ],
    "estimatedMinutes": 480,
    "categoryId": "cat-789",
    "instructorUserId": "user-123",
    "instructorName": "John Developer",
    "publishedAt": "2026-01-20T10:00:00Z",
    "createdAt": "2026-01-15T08:00:00Z",
    "modules": [
      {
        "id": "mod-1",
        "title": "Module 1: Hooks Deep Dive",
        "orderIndex": 1,
        "lessons": [
          {
            "id": "les-1",
            "title": "useState vs useReducer",
            "orderIndex": 1,
            "duration": 45
          }
        ]
      }
    ],
    "userEnrollment": null  // null if not enrolled
  }
}

Response (403):
{
  "success": false,
  "error": "COURSE_NOT_PUBLISHED"
}

Status Codes:
- 200: Success
- 403: Draft course, not authorized
- 404: Course not found
```

#### Create Course
```
POST /api/v1/organizations/:organizationId/courses
Authentication: Required
Authorization: Instructor or Admin

Request Body:
{
  "title": "Advanced React",
  "description": "Learn React patterns",
  "categoryId": "cat-123",
  "price": 49.99,
  "difficulty": "Advanced",
  "learningObjectives": ["Master hooks", "Optimize performance"],
  "estimatedMinutes": 480
}

Response (201):
{
  "success": true,
  "course": {
    "id": "course-new-123",
    "title": "Advanced React",
    "slug": "advanced-react",
    "status": "DRAFT",
    "organizationId": "org-456",
    "instructorUserId": "user-123",
    "createdAt": "2026-02-01T14:30:00Z"
  }
}

Status Codes:
- 201: Created successfully
- 400: Invalid input
- 401: Not authenticated
- 403: Not instructor/admin
```

#### Update Course
```
PUT /api/v1/organizations/:organizationId/courses/:courseId
Authentication: Required
Authorization: Instructor or Admin

Request Body:
{
  "title": "Advanced React 2026",
  "price": 59.99,
  "status": "PUBLISHED"
}

Response (200):
{
  "success": true,
  "course": {
    "id": "course-123",
    "title": "Advanced React 2026",
    "price": 59.99,
    "status": "PUBLISHED",
    "updatedAt": "2026-02-01T14:40:00Z"
  }
}

Status Codes:
- 200: Updated
- 400: Invalid input
- 401: Not authenticated
- 403: Not owner/admin
- 404: Course not found
```

#### Delete Course
```
DELETE /api/v1/organizations/:organizationId/courses/:courseId
Authentication: Required
Authorization: Admin only

Response (200):
{
  "success": true,
  "message": "Course deleted"
}

Status Codes:
- 200: Deleted
- 401: Not authenticated
- 403: Not admin
- 404: Course not found
```

---

### Enrollment Endpoints

#### Enroll in Course
```
POST /api/v1/organizations/:organizationId/enrollments
Authentication: Required
Authorization: Student in organization

Request Body:
{
  "courseId": "course-123"
}

Response (201):
{
  "success": true,
  "enrollment": {
    "id": "enroll-123",
    "userId": "user-456",
    "courseId": "course-123",
    "status": "ACTIVE",
    "enrolledAt": "2026-02-01T15:00:00Z",
    "progress": 0,
    "completedAt": null
  }
}

Response (409):
{
  "success": false,
  "error": "ALREADY_ENROLLED"
}

Status Codes:
- 201: Enrolled successfully
- 400: Invalid course
- 401: Not authenticated
- 403: Not a student
- 404: Course not found
- 409: Already enrolled
```

#### List My Enrollments
```
GET /api/v1/organizations/:organizationId/enrollments
Authentication: Required

Query Parameters:
- status: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
- limit: number (default: 20)
- offset: number (default: 0)

Response (200):
{
  "success": true,
  "enrollments": [
    {
      "id": "enroll-123",
      "courseId": "course-123",
      "courseName": "React Advanced",
      "progress": 65,
      "status": "ACTIVE",
      "enrolledAt": "2026-01-15T10:00:00Z",
      "completedAt": null,
      "lastAccessedAt": "2026-02-01T14:30:00Z",
      "nextLessonId": "les-45"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}

Status Codes:
- 200: Success
- 401: Not authenticated
```

---

### Progress Tracking Endpoints

#### Get Course Progress
```
GET /api/v1/organizations/:organizationId/courses/:courseId/progress
Authentication: Required

Response (200):
{
  "success": true,
  "progress": {
    "enrollmentId": "enroll-123",
    "courseId": "course-123",
    "completionPercentage": 65,
    "lastAccessedAt": "2026-02-01T14:30:00Z",
    "nextLessonId": "les-45",
    "modules": [
      {
        "moduleId": "mod-1",
        "title": "Module 1",
        "completionPercentage": 100,
        "lessons": [
          {
            "lessonId": "les-1",
            "title": "Lesson 1",
            "completed": true,
            "completedAt": "2026-01-20T10:30:00Z"
          }
        ]
      }
    ]
  }
}

Status Codes:
- 200: Success
- 401: Not authenticated
- 403: Not enrolled
- 404: Course not found
```

#### Mark Lesson Complete
```
POST /api/v1/organizations/:organizationId/lessons/:lessonId/complete
Authentication: Required

Response (200):
{
  "success": true,
  "progress": {
    "lessonId": "les-1",
    "completed": true,
    "completedAt": "2026-02-01T15:00:00Z",
    "courseProgress": 67
  }
}

Status Codes:
- 200: Marked complete
- 401: Not authenticated
- 403: Not enrolled
- 404: Lesson not found
```

---

### Quiz Endpoints

#### Get Quiz
```
GET /api/v1/organizations/:organizationId/quizzes/:quizId
Authentication: Required

Response (200):
{
  "success": true,
  "quiz": {
    "id": "quiz-123",
    "title": "Module 1 Assessment",
    "description": "Test your knowledge",
    "passingPercentage": 70,
    "totalAttempts": 3,
    "questions": [
      {
        "id": "q-1",
        "title": "What is React?",
        "type": "MULTIPLE_CHOICE",
        "options": [
          { "id": "opt-1", "text": "A library" },
          { "id": "opt-2", "text": "A framework" }
        ]
      }
    ]
  }
}

Status Codes:
- 200: Success
- 404: Quiz not found
```

#### Submit Quiz Attempt
```
POST /api/v1/organizations/:organizationId/quizzes/:quizId/attempts
Authentication: Required

Request Body:
{
  "answers": [
    {
      "questionId": "q-1",
      "selectedOptionId": "opt-1"
    }
  ]
}

Response (201):
{
  "success": true,
  "attempt": {
    "id": "attempt-123",
    "quizId": "quiz-123",
    "score": 85,
    "percentage": 85,
    "passed": true,
    "totalQuestions": 5,
    "correctAnswers": 4,
    "submittedAt": "2026-02-01T15:30:00Z"
  }
}

Status Codes:
- 201: Attempt submitted
- 400: Invalid answers
- 401: Not authenticated
- 403: Attempt limit exceeded
- 404: Quiz not found
```

---

### Certificate Endpoints

#### Get Certificate
```
GET /api/v1/organizations/:organizationId/certificates/:certificateId
Authentication: Required

Response (200):
{
  "success": true,
  "certificate": {
    "id": "cert-123",
    "courseId": "course-123",
    "courseName": "React Advanced",
    "userId": "user-456",
    "userName": "John Doe",
    "issuedDate": "2026-02-01T16:00:00Z",
    "certificateNumber": "CERT-2026-001",
    "certificateUrl": "https://res.cloudinary.com/.../cert.pdf"
  }
}

Status Codes:
- 200: Success
- 404: Certificate not found
```

#### Verify Public Certificate
```
GET /api/v1/certificates/verify/:certificateNumber
Authentication: Not required

Response (200):
{
  "success": true,
  "certificate": {
    "certificateNumber": "CERT-2026-001",
    "courseName": "React Advanced",
    "studentName": "John Doe",
    "issuedDate": "2026-02-01T16:00:00Z",
    "isValid": true
  }
}

Response (404):
{
  "success": false,
  "error": "CERTIFICATE_NOT_FOUND"
}

Status Codes:
- 200: Valid certificate
- 404: Certificate not found
```

---

### Search Endpoint

#### Full-Text Search Courses
```
GET /api/v1/organizations/:organizationId/search
Authentication: Optional

Query Parameters:
- q: string (search query)
- limit: number (default: 20)
- offset: number (default: 0)
- filters: string (JSON: {"difficulty": "Advanced", "minPrice": 0})

Response (200):
{
  "success": true,
  "results": [
    {
      "id": "course-123",
      "title": "React Advanced Patterns",
      "description": "...",
      "relevanceScore": 0.95
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}

Status Codes:
- 200: Success
- 400: Invalid query
- 404: Organization not found
```

---

### Notification Endpoints

#### Get Notifications
```
GET /api/v1/organizations/:organizationId/notifications
Authentication: Required

Query Parameters:
- unreadOnly: boolean (default: false)
- limit: number (default: 20)
- offset: number (default: 0)

Response (200):
{
  "success": true,
  "notifications": [
    {
      "id": "notif-123",
      "title": "Course Enrolled",
      "message": "You were enrolled in React Advanced",
      "type": "ENROLLMENT",
      "read": false,
      "createdAt": "2026-02-01T16:30:00Z"
    }
  ],
  "total": 5,
  "unreadCount": 3
}

Status Codes:
- 200: Success
- 401: Not authenticated
```

#### Mark Notification as Read
```
PATCH /api/v1/organizations/:organizationId/notifications/:notificationId/read
Authentication: Required

Response (200):
{
  "success": true,
  "notification": {
    "id": "notif-123",
    "read": true,
    "readAt": "2026-02-01T16:45:00Z"
  }
}

Status Codes:
- 200: Marked as read
- 404: Notification not found
```

---

### Audit Log Endpoints

#### Get Organization Audit Logs
```
GET /api/v1/org/:organizationId/audit-logs
Authentication: Required
Authorization: Admin only

Query Parameters:
- action: string (optional filter)
- resourceType: string (optional filter)
- userId: string (optional filter)
- limit: number (default: 50)
- offset: number (default: 0)
- from: ISO datetime (optional)
- to: ISO datetime (optional)

Response (200):
{
  "success": true,
  "auditLogs": [
    {
      "id": "log-123",
      "action": "CREATE",
      "resourceType": "COURSE",
      "resourceId": "course-123",
      "userId": "user-456",
      "actorName": "John Instructor",
      "changes": {
        "before": null,
        "after": { "title": "React Advanced" }
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ],
  "total": 245,
  "limit": 50,
  "offset": 0
}

Status Codes:
- 200: Success
- 401: Not authenticated
- 403: Not admin
```

---

### Media Upload Endpoints

#### Get Upload URL
```
POST /api/v1/organizations/:organizationId/media/upload-url
Authentication: Required

Request Body:
{
  "filename": "course-thumbnail.jpg",
  "contentType": "image/jpeg"
}

Response (200):
{
  "success": true,
  "uploadUrl": "https://res.cloudinary.com/.../upload",
  "signature": "abc123...",
  "publicId": "learnflow/course-123",
  "timestamp": 1701129600
}

Status Codes:
- 200: URL generated
- 400: Invalid file type
- 401: Not authenticated
```

#### Upload Media via Cloudinary
Direct upload to Cloudinary (client-side, see security.md for details)

---

### Health & Readiness Endpoints

#### Health Check
```
GET /health
Authentication: Not required
Rate Limit: Exempt

Response (200):
{
  "status": "healthy",
  "service": "learnflow-api",
  "version": "1.0.0",
  "timestamp": "2026-02-01T17:00:00Z"
}
```

#### Liveness Probe
```
GET /api/health
Authentication: Not required
Rate Limit: Exempt

Response (200):
{
  "status": "ready",
  "service": "learnflow-api",
  "version": "1.0.0",
  "timestamp": "2026-02-01T17:00:00Z",
  "uptimeSeconds": 3600,
  "dependencies": {
    "database": { "status": "ready" },
    "redis": { "status": "ready" },
    "objectStorage": { "status": "ready" }
  }
}

Response (200 - Degraded):
{
  "status": "degraded",
  "dependencies": {
    "database": { "status": "down", "error": "Connection timeout" },
    "redis": { "status": "ready" },
    "objectStorage": { "status": "ready" }
  }
}
```

#### Readiness Probe
```
GET /api/ready
Authentication: Not required
Rate Limit: Exempt

Response (200):
{
  "status": "ready",
  ...
}

Response (503):
{
  "status": "degraded",
  "dependencies": { ... }
}

Status Codes:
- 200: Ready to serve requests
- 503: Not ready (dependency unavailable)
```

---

## Error Handling

### Error Response Format

All errors return JSON with `success: false` and `error` field:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message (optional)"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_CREDENTIALS | 400 | Email or password incorrect |
| INVALID_EMAIL | 400 | Email format invalid |
| INVALID_PASSWORD | 400 | Password too weak |
| INVALID_INPUT | 400 | Request body validation failed |
| INVALID_JSON | 400 | Malformed JSON |
| EMAIL_ALREADY_EXISTS | 409 | Email already registered |
| EMAIL_NOT_VERIFIED | 403 | Email not verified |
| NOT_AUTHENTICATED | 401 | Missing or invalid session |
| NOT_AUTHORIZED | 403 | Insufficient permissions |
| RESOURCE_NOT_FOUND | 404 | Resource doesn't exist |
| ALREADY_ENROLLED | 409 | User already enrolled |
| ATTEMPT_LIMIT_EXCEEDED | 429 | Too many attempts |
| RATE_LIMITED | 429 | Rate limit exceeded |
| SERVER_ERROR | 500 | Unexpected server error |

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not authorized) |
| 404 | Not Found |
| 409 | Conflict (duplicate, etc.) |
| 413 | Payload Too Large |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

### Global Rate Limits

```
Per IP Address: 100 requests per 15 minutes
Per Endpoint: 50 requests per 15 minutes
```

### Auth Endpoint Limits (Stricter)

```
POST /auth/login: 5 attempts per 15 minutes
POST /auth/password-reset: 3 requests per hour
POST /auth/verify-email: 5 attempts per hour
```

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701134400
```

**Exempt Endpoints**:
- `/health`
- `/api/health`
- `/api/ready`

---

## CORS & Security

### Allowed Origins

```javascript
// Development
- http://localhost:3000
- http://localhost:5173

// Production
- https://app.learnflow.com
- https://www.learnflow.com
```

### CORS Response Headers

```
Access-Control-Allow-Origin: https://app.learnflow.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Organization-Id
Access-Control-Max-Age: 86400
```

### Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## Pagination

### Pagination Format

All list endpoints support pagination:

```
GET /api/v1/organizations/:orgId/courses?limit=20&offset=0
```

### Response Format

```json
{
  "success": true,
  "data": [ /* items */ ],
  "total": 245,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

**Parameters**:
- `limit`: Items per page (max 100)
- `offset`: Starting position (0-indexed)

**Calculated Fields**:
- `total`: Total items matching query
- `hasMore`: Whether more items exist

---

## Sorting & Filtering

### Sorting

Some endpoints support sorting:

```
GET /api/v1/organizations/:orgId/courses?sortBy=title&sortOrder=asc
```

### Filtering

Filter by query parameters:

```
GET /api/v1/organizations/:orgId/courses?status=PUBLISHED&difficulty=Advanced
```

---

## Timestamps

All timestamps are ISO 8601 format with timezone:

```json
{
  "createdAt": "2026-02-01T10:30:00Z",
  "updatedAt": "2026-02-01T14:45:00Z"
}
```

---

## Versioning

API version in URL path: `/api/v1/`

**Current Version**: `v1`

Future versions will use `/api/v2/`, etc.

---

## API Client Examples

### JavaScript/TypeScript

```typescript
// Fetch with credentials (cookies)
const response = await fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',  // Send cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
```

### cURL

```bash
# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Use session in next request
curl http://localhost:4000/api/v1/auth/me \
  -b cookies.txt
```

### Python

```python
import requests

session = requests.Session()

# Login
response = session.post('http://localhost:4000/api/v1/auth/login', json={
    'email': 'user@example.com',
    'password': 'password123'
})

# Session maintained automatically
me = session.get('http://localhost:4000/api/v1/auth/me')
print(me.json())
```

---

## Background Jobs

### Email Sending

Emails (verification, password reset) are sent asynchronously via BullMQ:

```
Request: POST /auth/register
  ↓
1. Create user
2. Queue email job (BullMQ)
3. Response sent (50ms)
  ↓
Background Worker
  ↓
Send email (500-2000ms)
```

This prevents slow SMTP delays from blocking API responses.

### Notifications

Notifications are queued and processed asynchronously:

```
Event: User enrolls in course
  ↓
1. Create enrollment
2. Queue notification
3. Return response
  ↓
Background Worker
  ↓
Send notifications (websockets, push, email)
```

---

## References

- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpwg.org/)
- [JSON API Specification](https://jsonapi.org/)
- [OpenAPI/Swagger Spec](https://swagger.io/)