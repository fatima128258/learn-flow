# Authentication System

Complete authentication implementation for LearnFlow with email verification, password reset, multi-tenancy, and role-based access control (RBAC).

## Features Implemented

### Core Authentication
- ✅ User registration with email verification
- ✅ Secure password hashing (Argon2id)
- ✅ Login with rate limiting (5 attempts per 15 minutes)
- ✅ Session-based authentication (7-day sessions)
- ✅ HTTP-only secure cookies
- ✅ Logout with session revocation

### Email Workflows
- ✅ Email verification on registration
- ✅ Resend verification email
- ✅ Password reset via email
- ✅ Time-limited tokens (24h verification, 1h reset)
- ✅ Single-use tokens (marked as used)
- ✅ Email delivery via Mailpit (development) or SMTP (production)

### Security
- ✅ Argon2id password hashing
- ✅ SHA-256 token hashing
- ✅ Redis-based rate limiting
- ✅ Session revocation on password reset
- ✅ No email enumeration (consistent responses)
- ✅ No plaintext passwords in logs
- ✅ CORS with credentials support
- ✅ Input validation
- ✅ SQL injection protection (Prisma)

### Multi-Tenancy & RBAC
- ✅ Organization model with slug
- ✅ User-Organization junction table
- ✅ Four role levels: `PLATFORM_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`, `STUDENT`
- ✅ Middleware for organization context validation
- ✅ Middleware for role-based authorization
- ✅ Server-side role checks (never trust client)
- ✅ Tenant isolation at database level

## API Endpoints

### Public Routes

#### `POST /api/v1/auth/register`
Register a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123",
  "confirmPassword": "securepass123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false,
    "createdAt": "2026-08-22T10:00:00Z"
  }
}
```

**Errors:**
- `400 MISSING_FIELDS` - Missing required fields
- `400 PASSWORD_MISMATCH` - Passwords don't match
- `409 EMAIL_TAKEN` - Email already registered
- `429 TOO_MANY_ATTEMPTS` - Rate limit exceeded

---

#### `POST /api/v1/auth/login`
Authenticate and create session.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true,
    "createdAt": "2026-08-22T10:00:00Z"
  }
}
```

**Errors:**
- `400 MISSING_FIELDS` - Missing email or password
- `401 INVALID_CREDENTIALS` - Wrong email or password
- `429 TOO_MANY_ATTEMPTS` - Too many failed attempts

---

#### `POST /api/v1/auth/logout`
Revoke current session.

**Response (200):**
```json
{
  "ok": true
}
```

---

#### `POST /api/v1/auth/forgot-password`
Request password reset email.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists, a password reset email has been sent"
}
```

---

#### `POST /api/v1/auth/reset-password`
Reset password with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

**Errors:**
- `400 INVALID_TOKEN` - Invalid token
- `400 TOKEN_EXPIRED` - Token expired
- `400 TOKEN_ALREADY_USED` - Token already used
- `400 PASSWORD_MISMATCH` - Passwords don't match
- `400 PASSWORD_TOO_SHORT` - Password < 8 characters

---

#### `POST /api/v1/auth/verify-email`
Verify email with token.

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

**Errors:**
- `400 INVALID_TOKEN` - Invalid token
- `400 TOKEN_EXPIRED` - Token expired
- `400 TOKEN_ALREADY_USED` - Already verified

---

#### `POST /api/v1/auth/resend-verification`
Resend verification email.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "If unverified, a verification email has been sent"
}
```

---

### Protected Routes

#### `GET /api/v1/auth/me`
Get current user information.

**Headers:**
```
Cookie: learnflow_session=<session-token>
```

**Response (200):**
```json
{
  "user": {
    "id": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true,
    "createdAt": "2026-08-22T10:00:00Z"
  }
}
```

**Errors:**
- `401 NOT_AUTHENTICATED` - No valid session
- `401 SESSION_INVALID` - Session expired or revoked

---

## Frontend Pages

### `/register`
User registration with:
- Name, email, password fields
- Client-side validation
- Password confirmation
- Success message with redirect

### `/login`
User login with:
- Email, password fields
- Error handling
- Redirect on success

### `/forgot-password`
Password reset request with:
- Email input
- Success message (no enumeration)

### `/reset-password?token=...`
Password reset form with:
- New password fields
- Token validation
- Error handling
- Redirect to login on success

### `/verify-email?token=...`
Email verification with:
- Automatic verification on page load
- Success/error messages
- Redirect to home on success

---

## Middleware

### `requireAuth`
Validates session and attaches user to request.

**Usage:**
```typescript
router.get('/protected', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user.id;
  // ...
});
```

### `requireVerifiedEmail`
Ensures email is verified. Use after `requireAuth`.

**Usage:**
```typescript
router.post('/course', requireAuth, requireVerifiedEmail, handler);
```

### `requireOrganizationContext`
Validates user has access to organization and attaches role.

**Usage:**
```typescript
router.get('/org/:organizationId/courses', 
  requireAuth, 
  requireOrganizationContext, 
  (req: AuthenticatedRequest, res) => {
    const orgId = req.user.organizationId;
    const role = req.user.role; // PLATFORM_ADMIN | ORG_ADMIN | INSTRUCTOR | STUDENT
    // ...
  }
);
```

### `requireRole(...roles)`
Enforces role-based access. Use after `requireOrganizationContext`.

**Usage:**
```typescript
router.post('/org/:organizationId/courses', 
  requireAuth,
  requireOrganizationContext,
  requireRole('ORG_ADMIN', 'INSTRUCTOR'),
  handler
);
```

### `requirePlatformAdmin`
Restricts to platform administrators only.

**Usage:**
```typescript
router.delete('/users/:userId', requireAuth, requirePlatformAdmin, handler);
```

---

## Testing

### Manual Testing with Mailpit

1. Start services:
```bash
docker-compose up -d
```

2. Access Mailpit UI:
```
http://localhost:8025
```

3. Register a new user at:
```
http://localhost:3000/register
```

4. Check Mailpit for verification email

5. Click verification link or copy token

6. Test password reset flow

### Automated Tests

Run API tests:
```bash
cd apps/api
npm test
```

Tests cover:
- Registration (success, duplicate email, validation)
- Login (success, invalid credentials, rate limiting)
- Logout
- Password reset flow
- Email verification flow
- Protected routes

---

## Security Considerations

### Password Security
- Argon2id with default parameters
- Minimum 8 characters enforced
- No complexity requirements (consider adding policy)

### Session Security
- HTTP-only cookies (no JavaScript access)
- Secure flag in production
- SameSite=Lax (CSRF protection)
- 7-day expiry
- Revoked on password reset

### Rate Limiting
- 5 login attempts per IP per 15 minutes
- Tracked in Redis
- Reset on successful login

### Token Security
- Tokens hashed with SHA-256 before storage
- Never store plaintext tokens
- Time-limited expiry
- Single-use enforcement

### Multi-Tenancy
- Organization ID validated server-side
- User-org relationship checked in database
- No trust of client-supplied org context

### RBAC
- Roles stored in database, not in JWT
- Middleware validates role from database
- Cannot escalate privileges without database update

### Common Vulnerabilities Mitigated
- ✅ SQL Injection (Prisma parameterized queries)
- ✅ XSS (HTTP-only cookies, input sanitization)
- ✅ CSRF (SameSite cookies)
- ✅ Session Fixation (new token on login)
- ✅ Brute Force (rate limiting)
- ✅ Email Enumeration (consistent responses)
- ✅ IDOR (server-side org/role checks)
- ✅ Role Escalation (database role validation)

---

## Database Schema

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

model EmailVerificationToken {
  userId    String
  tokenHash String @unique
  expiresAt DateTime
  used      Boolean
}

model PasswordResetToken {
  userId    String
  tokenHash String @unique
  expiresAt DateTime
  used      Boolean
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Redis
REDIS_URL=redis://localhost:6379

# Email
MAIL_SMTP_HOST=mailpit
MAIL_SMTP_PORT=1025
MAIL_FROM=no-reply@learnflow.local

# App
APP_URL=http://localhost:3000

# Session
SESSION_COOKIE_NAME=learnflow_session
SESSION_COOKIE_SECURE=false  # Set to true in production
SESSION_TTL_SECONDS=604800  # 7 days
```

---

## Future Enhancements

- [ ] OAuth/SSO (Google, Microsoft, GitHub)
- [ ] Two-factor authentication (2FA)
- [ ] Account lockout after N failed attempts
- [ ] Device fingerprinting
- [ ] Session management UI
- [ ] Audit logs for auth events
- [ ] Magic link authentication
- [ ] Passkey/WebAuthn support
