# ADR-003: Authentication Strategy

**Status:** Accepted  
**Date:** 2026-08-22  
**Deciders:** Development Team  
**Technical Story:** Authentication and Authorization Implementation

## Context

LearnFlow is a multi-tenant learning management platform requiring secure authentication with support for multiple user roles (Platform Admin, Organization Admin, Instructor, Student) and organization-based access control. The system needs to:

1. Authenticate users securely
2. Support email verification
3. Provide password reset functionality
4. Enforce multi-tenant isolation
5. Implement role-based access control (RBAC)
6. Prevent common security vulnerabilities (CSRF, session fixation, brute force, IDOR)
7. Support both development and production environments

## Decision

We will implement a **session-based authentication** system with the following architecture:

### Core Components

1. **Password Storage**
   - Use Argon2id for password hashing
   - Argon2 is OWASP-recommended and resistant to GPU cracking attacks
   - No plaintext passwords stored or logged

2. **Session Management**
   - Generate cryptographically random session tokens (32 bytes)
   - Store SHA-256 hashed tokens in PostgreSQL
   - Set session expiry to 7 days
   - Support session revocation (logout, password reset)
   - HTTP-only, Secure, SameSite=Lax cookies in production

3. **Email Verification**
   - Send verification emails on registration
   - Tokens expire after 24 hours
   - Mark tokens as "used" to prevent replay
   - Use Mailpit for local development, production SMTP for deployment

4. **Password Reset**
   - Time-limited reset tokens (1 hour expiry)
   - Single-use tokens (marked as used after reset)
   - Revoke all user sessions on password reset
   - Don't reveal if email exists (prevent enumeration)

5. **Multi-Tenancy & RBAC**
   - Organization-scoped access via `UserOrganization` junction table
   - Four role levels: `PLATFORM_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`, `STUDENT`
   - Middleware enforces organization context on protected routes
   - Server-side role validation (never trust client)
   - Organization ID from route params, headers, or query string

6. **Security Measures**
   - Rate limiting on login attempts (5 attempts per 15 minutes per IP) via Redis
   - CORS with credentials support
   - Input validation on all endpoints
   - Prepared statements via Prisma (SQL injection protection)
   - No sensitive data in error messages
   - Token hashing (SHA-256) for verification/reset tokens

### API Endpoints

**Public Routes:**
- `POST /api/v1/auth/register` - Create account with email verification
- `POST /api/v1/auth/login` - Authenticate and create session
- `POST /api/v1/auth/logout` - Revoke session
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token
- `POST /api/v1/auth/verify-email` - Verify email with token
- `POST /api/v1/auth/resend-verification` - Resend verification email

**Protected Routes:**
- `GET /api/v1/auth/me` - Get current user info (requires auth)

### Middleware Stack

1. **`requireAuth`** - Validates session, attaches user to request
2. **`requireVerifiedEmail`** - Ensures email is verified
3. **`requireOrganizationContext`** - Validates org access, attaches role
4. **`requireRole(...roles)`** - Enforces role-based authorization
5. **`requirePlatformAdmin`** - Restricts to platform admins only

### Database Schema

```prisma
enum UserRole {
  PLATFORM_ADMIN
  ORG_ADMIN
  INSTRUCTOR
  STUDENT
}

model User {
  id             String
  email          String @unique
  passwordHash   String
  emailVerified  Boolean
  sessions       Session[]
  organizations  UserOrganization[]
}

model Organization {
  id    String
  name  String
  slug  String @unique
  users UserOrganization[]
}

model UserOrganization {
  userId         String
  organizationId String
  role           UserRole
  @@unique([userId, organizationId])
}

model Session {
  userId    String
  tokenHash String @unique
  expiresAt DateTime
  revoked   Boolean
}
```

## Consequences

### Positive

- **Security:** Industry-standard practices (Argon2, token hashing, rate limiting)
- **Multi-tenancy:** Clear organization isolation at database and application layers
- **RBAC:** Flexible role system supports all user types
- **Auditability:** Sessions tracked in database
- **Scalability:** Redis-based rate limiting scales horizontally
- **Developer Experience:** Clear middleware composition, easy to test

### Negative

- **Session Storage:** Requires database roundtrip on each authenticated request (mitigable with Redis caching if needed)
- **Token Management:** More complex than JWT (but more secure for web apps)
- **Email Dependency:** Registration flow depends on email delivery

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Session hijacking | HTTP-only cookies, Secure flag in production, short expiry |
| Brute force attacks | Redis-based rate limiting, account lockout considerations |
| Email enumeration | Always return success for forgot-password/resend-verification |
| IDOR | Server-side org/role checks, never trust client input |
| Role escalation | Middleware validates roles from database, not from JWT payload |
| CSRF | SameSite=Lax cookies, consider CSRF tokens for state-changing operations |

### Not Implemented (Future)

- OAuth/SSO integration (Google, Microsoft, GitHub)
- Two-factor authentication (2FA/MFA)
- Device fingerprinting
- Account lockout after repeated failed attempts
- Audit logs for authentication events
- Session management UI (view/revoke active sessions)

## Alternatives Considered

### JWT-based Authentication

**Pros:** Stateless, no database lookup per request  
**Cons:** Cannot revoke tokens before expiry, larger cookies, refresh token complexity, storage of sensitive data in client  
**Decision:** Session-based is more appropriate for a web application with sensitive data

### OAuth-only (No Password Auth)

**Pros:** Offload authentication to identity providers  
**Cons:** Requires external dependencies, limits user choice, harder for local development  
**Decision:** Email/password + OAuth (future) provides best flexibility

### Monolithic Auth Service

**Pros:** Separation of concerns  
**Cons:** Adds operational complexity, network latency  
**Decision:** Integrated auth service is simpler for current scale

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Argon2 Password Hashing](https://github.com/P-H-C/phc-winner-argon2)
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
