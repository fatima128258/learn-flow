# Security Architecture

This document describes the security architecture, threat model, and implemented security controls in LearnFlow.

## Overview

LearnFlow implements a defense-in-depth security strategy covering authentication, authorization, data protection, and audit logging. The system is designed to protect:

- **User Data**: Personally identifiable information (PII), course progress, payment information
- **Financial Data**: Orders, payments, pricing, discounts, transaction records
- **Course Content**: Intellectual property, lessons, quizzes, certificates
- **Multi-Tenant Isolation**: Data belonging to different organizations must not leak
- **Compliance**: GDPR, CCPA, PCI-DSS (for payment handling)

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (HTTPS)                  │
│              Secure Communication                   │
└─────────────────────────────────────────────────────┘
                       ↓ TLS/HTTPS ↓
┌─────────────────────────────────────────────────────┐
│                  API Gateway Layer                   │
│    ├─ CORS Validation                               │
│    ├─ Rate Limiting                                 │
│    ├─ Request Validation                            │
│    └─ HTTPS Enforcement                             │
└─────────────────────────────────────────────────────┘
                       ↓ Internal ↓
┌─────────────────────────────────────────────────────┐
│              Authentication Layer                    │
│    ├─ Session Token Management                      │
│    ├─ Email Verification                            │
│    ├─ Password Security (Argon2)                    │
│    └─ CSRF Protection                               │
└─────────────────────────────────────────────────────┘
                       ↓ Internal ↓
┌─────────────────────────────────────────────────────┐
│             Authorization Layer (RBAC)              │
│    ├─ Role-Based Access Control                     │
│    ├─ Multi-Tenant Context Validation               │
│    ├─ Resource Ownership Checks                     │
│    └─ Fine-Grained Permissions                      │
└─────────────────────────────────────────────────────┘
                       ↓ Internal ↓
┌─────────────────────────────────────────────────────┐
│             Data Access Layer                        │
│    ├─ Parameterized Queries (Prisma ORM)            │
│    ├─ SQL Injection Prevention                      │
│    ├─ Encryption at Rest                            │
│    └─ Audit Logging                                 │
└─────────────────────────────────────────────────────┘
                       ↓ SQL/TLS ↓
┌─────────────────────────────────────────────────────┐
│                 PostgreSQL Database                  │
│    ├─ TLS Connection Encryption                     │
│    ├─ Role-Based DB Access                          │
│    ├─ Encrypted Sensitive Fields                    │
│    └─ Audit Log Immutability                        │
└─────────────────────────────────────────────────────┘
```

## Authentication

### Email-Based Authentication

LearnFlow uses email-based authentication with secure session tokens:

#### Registration Flow
```
1. User submits email + password
2. Password validated (min 8 chars, complexity)
3. Password hashed with Argon2 (pepper + salt)
4. User created in database (inactive)
5. Email verification token sent
6. User clicks link, email verified
7. User can now login
```

#### Login Flow
```
1. User submits email + password
2. User looked up by email
3. Password compared against hash (Argon2)
4. Session token generated (secure random 32 bytes)
5. Session stored in Redis (Redis + DB for recovery)
6. Session ID returned in httpOnly cookie
7. User authenticated for future requests
```

### Password Security

**Implementation**:
- **Algorithm**: Argon2id (industry best practice)
- **Hashing Library**: `argon2@0.30.3`
- **Salt**: Automatic 16-byte salt per password
- **Time Cost**: 2 iterations
- **Memory Cost**: 19 MB
- **Parallelism**: 1 thread

```typescript
// Password hashing
const passwordHash = await hash(password, {
  type: argon2id,
  timeCost: 2,
  memoryCost: 19456,
  parallelism: 1
});

// Password verification
const isValid = await verify(storedHash, userPassword);
```

**Security Properties**:
- ✓ Resistant to GPU/ASIC attacks (memory-hard)
- ✓ Resistant to timing attacks (constant-time comparison)
- ✓ Resistant to rainbow tables (random salt)
- ✓ Future-proof (configurable cost parameters)

### Session Management

**Session Storage**:
- **Primary**: Redis (fast access, session state)
- **Backup**: PostgreSQL (recovery, audit)

**Session Token**:
```typescript
interface Session {
  id: string              // Session ID (CUID)
  userId: string          // User owning session
  organizationId: string  // Current organization context
  tokenHash: string       // Hashed token (indexed, cannot reverse)
  expiresAt: DateTime     // Expiration time (24 hours default)
  revoked: boolean        // Explicit revocation flag
  createdAt: DateTime
}
```

**Token Storage**:
```typescript
// Never store plain tokens in database
// Store only hash (one-way)
const tokenHash = sha256(token);

// Token transmitted only in httpOnly cookie
res.cookie('sessionId', token, {
  httpOnly: true,       // Inaccessible to JavaScript (XSS protection)
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  maxAge: 24 * 60 * 60 * 1000  // 24 hours
});
```

**Session Expiration**:
- Default: 24 hours
- Extended on each request
- Explicit logout revokes session immediately
- Password reset revokes all sessions (security event)

### Email Verification

**Flow**:
```
1. Registration creates EmailVerificationToken
2. Token hashed before storing in DB
3. Email sent with verification link
4. Link includes plain token (not hashed)
5. User clicks link
6. Token verified: hash(token) matches DB hash
7. Email marked verified
8. Token marked used (cannot reuse)
```

**Token Security**:
- 32-byte random token
- Expires after 48 hours
- One-time use only
- Never logged in plain text
- Rate limited (3 attempts per hour)

### Password Reset

**Flow**:
```
1. User requests password reset
2. User lookup by email (no error on missing email - timing attack prevention)
3. PasswordResetToken created if user exists
4. Email sent with reset link (only if user exists)
5. User clicks link with token
6. Token verified and user identified
7. User enters new password
8. Password hashed with new salt
9. All sessions revoked (logout from all devices)
10. Success response sent
```

**Security Properties**:
- ✓ Timing-safe email lookup (same response time whether user exists or not)
- ✓ One-time tokens prevent reuse
- ✓ Email verification prevents unauthorized reset
- ✓ Session revocation prevents attacker keeping login
- ✓ Rate limited (3 requests per hour per email)

## Authorization (RBAC)

### Role Hierarchy

```
Organization Admin (ADMIN)
  └─ Can manage organization, create courses
  └─ Can manage users, assign roles
  └─ Can view audit logs, analytics
  └─ Can configure organization settings

Course Instructor (INSTRUCTOR)
  └─ Can create and edit courses
  └─ Can view student enrollments
  └─ Can view course analytics
  └─ Cannot delete courses (admin only)

Student (STUDENT)
  └─ Can enroll in published courses
  └─ Can view own progress
  └─ Can take quizzes
  └─ Cannot manage courses or users
```

### Multi-Tenant Context Validation

Every request validates:

```typescript
// Middleware validates user belongs to requested organization
app.use(async (req, res, next) => {
  const session = req.session;
  const requestedOrgId = req.params.organizationId || req.body.organizationId;
  
  // Verify user is member of organization
  const membership = await db.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: requestedOrgId
      }
    }
  });
  
  if (!membership) {
    throw new ForbiddenError('Not a member of this organization');
  }
  
  // Verify role has permission
  if (requiredRole && !hasRole(membership.role, requiredRole)) {
    throw new ForbiddenError('Insufficient permissions');
  }
  
  next();
});
```

### Authorization Checks

**Resource-Level Authorization**:
```typescript
async updateCourse(courseId: string, organizationId: string, userId: string) {
  // 1. Get course
  const course = await db.course.findUnique({ where: { id: courseId } });
  
  // 2. Verify course belongs to organization
  if (course.organizationId !== organizationId) {
    throw new NotFoundError();  // Don't reveal course exists
  }
  
  // 3. Verify user is instructor of course or org admin
  const membership = await db.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } }
  });
  
  if (membership.role !== 'ADMIN' && course.instructorUserId !== userId) {
    throw new ForbiddenError();
  }
  
  // 4. Proceed with update
  return db.course.update({
    where: { id: courseId },
    data: updateData
  });
}
```

## Multi-Tenant Isolation

### Tenant Boundary Enforcement

**At Middleware Level**:
```typescript
// Extract and validate tenant from request context
const organizationId = extractOrgFromSession();
const requestedOrgId = req.params.organizationId;

if (organizationId !== requestedOrgId) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

**At Query Level**:
```typescript
// All queries include organizationId filter
const courses = await db.course.findMany({
  where: {
    organizationId,      // Always filter by tenant
    status: 'PUBLISHED'
  }
});
```

**At Database Level**:
```sql
-- Foreign key prevents cross-tenant references
ALTER TABLE course
  ADD CONSTRAINT fk_course_org
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- Unique constraint prevents data mixing
CREATE UNIQUE INDEX idx_course_org_title 
  ON course(organization_id, title);
```

### Cascading Deletion

```sql
-- When organization deleted, all data deleted safely
-- Foreign keys enforce cascade
Organization [deleted]
  └─ UserOrganization [auto-delete]
  └─ Course [auto-delete]
      └─ Module [auto-delete]
      └─ Lesson [auto-delete]
      └─ Enrollment [auto-delete]
  └─ Category [auto-delete]
  └─ Order [auto-delete]
```

## Data Protection

### Encryption In Transit

**HTTPS/TLS**:
- All API endpoints require HTTPS
- TLS 1.2+ enforced
- HSTS headers sent (redirect HTTP → HTTPS)
- Certificate pinning optional for mobile apps

**Database Connection**:
- PostgreSQL connection encrypted with TLS
- Connection string requires `sslmode=require`

**Redis Connection**:
- Redis connection encrypted if TLS enabled
- Redis password authentication required

### Encryption At Rest

**Sensitive Fields** (Implemented):
- Password hashes: Argon2 (not reversible)
- Tokens: Hashed before storage
- API keys: Environment variables (not in code)

**Potential Enhancements** (Not Currently Implemented):
- Full-disk encryption on database server
- Column-level encryption for PII (GDPR requirement)
- Transparent Data Encryption (TDE) in PostgreSQL

**Current Status**: ⚠️ **Partially Implemented**
- Passwords and tokens are hashed
- Configuration secrets not stored in code
- Database connection encrypted
- File uploads through Cloudinary (third-party encryption)
- Email and PII stored in plaintext in database (GDPR risk)

### Input Validation

**Parameterized Queries**:
```typescript
// ✓ Safe: Parameterized query (Prisma ORM)
const user = await db.user.findUnique({
  where: { email: userInput }  // Parameter-bound
});

// ✗ Unsafe: String concatenation (SQL injection risk)
const user = await db.query(`SELECT * FROM user WHERE email = '${userInput}'`);
```

**Request Validation**:
```typescript
// Validate request input before processing
const createCourseSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  price: z.number().positive().max(99999),
  categoryId: z.string().uuid().optional()
});

const validated = createCourseSchema.parse(req.body);
```

**XSS Prevention**:
- Output encoding in React (automatic)
- Content-Security-Policy headers
- HttpOnly cookies (JavaScript cannot access)
- DOMPurify for user-generated content (not currently used)

## Audit Logging

### Audit Log Schema

```prisma
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String   // Tenant context
  userId         String   // Who performed action
  action         String   // CREATE, UPDATE, DELETE, etc.
  resourceType   String   // Course, User, Payment, etc.
  resourceId     String   // What was affected
  changes        Json     // Before/after values
  actorName      String   // User name (for deleted users)
  ipAddress      String   // Source IP
  userAgent      String   // Browser/client info
  createdAt      DateTime @default(now())
}
```

### Logged Events

| Event | Logged | Details |
|-------|--------|---------|
| User Registration | ✓ | Email, timestamp |
| User Login | ✓ | Email, IP address, timestamp |
| Password Change | ✓ | Timestamp, device ID |
| Password Reset | ✓ | Email, timestamp, IP |
| Course Creation | ✓ | Course ID, title, instructor |
| Course Update | ✓ | Course ID, changes made |
| Course Deletion | ✓ | Course ID, user who deleted |
| Enrollment | ✓ | User, course, timestamp |
| Payment | ✓ | Order ID, amount, method |
| User Role Change | ✓ | User, old role, new role |
| File Upload | ✓ | File name, size, URL |

### Audit Log Access

```typescript
// Only organization admins can view audit logs
const logs = await db.auditLog.findMany({
  where: {
    organizationId,  // Tenant isolation
    action: 'COURSE_UPDATE'
  },
  orderBy: { createdAt: 'desc' },
  take: 100
});
```

## Threat Model

### Threat: Unauthorized Data Access

**Attack Vector**: Attacker gains database access

**Mitigation**:
- ✓ Database passwords in environment variables
- ✓ Database connection uses TLS
- ✓ Database user has limited privileges (no admin)
- ⚠️ Data at rest not encrypted (GDPR gap)

**Residual Risk**: Medium (if db compromised, data readable)

### Threat: Cross-Tenant Data Leakage

**Attack Vector**: Bug in authorization code allows reading other org's data

**Mitigation**:
- ✓ Multi-tenant validation in middleware
- ✓ Query-level filtering on organizationId
- ✓ Foreign key constraints prevent cross-org references
- ✓ Code review + testing
- ⚠️ No row-level security (RLS) as defense-in-depth

**Residual Risk**: Medium (requires coordinated bugs in multiple layers)

### Threat: Session Hijacking

**Attack Vector**: Attacker steals session token from cookie

**Mitigation**:
- ✓ HttpOnly cookie (JavaScript cannot read)
- ✓ Secure flag (HTTPS only)
- ✓ SameSite=strict (CSRF protection)
- ✓ Session expires after 24 hours
- ✓ Session invalidates on logout/password reset

**Residual Risk**: Low (multiple protections)

### Threat: SQL Injection

**Attack Vector**: Attacker crafts malicious input to execute SQL

**Mitigation**:
- ✓ Parameterized queries (Prisma ORM)
- ✓ Input validation with Zod schemas
- ✓ No string concatenation in queries
- ✓ Database user lacks admin privileges

**Residual Risk**: Very Low (if using Prisma correctly)

### Threat: CSRF (Cross-Site Request Forgery)

**Attack Vector**: Attacker tricks user into making request from attacker's site

**Mitigation**:
- ✓ SameSite=strict cookies (no cross-site submission)
- ✓ Stateful sessions (attacker cannot forge session)
- ⚠️ No explicit CSRF tokens (relies on cookie protection)

**Residual Risk**: Low (SameSite provides strong protection)

### Threat: XSS (Cross-Site Scripting)

**Attack Vector**: Attacker injects malicious JavaScript into page

**Mitigation**:
- ✓ React auto-escapes output
- ✓ HttpOnly cookies (JavaScript cannot read sessions)
- ✓ Content-Security-Policy headers
- ⚠️ No DOMPurify for user-generated content

**Residual Risk**: Medium (if user content displayed unsanitized)

### Threat: DDoS (Distributed Denial of Service)

**Attack Vector**: Attacker floods API with requests

**Mitigation**:
- ⚠️ Rate limiting not currently implemented
- Cloud provider DDoS protection (if deployed)
- Load balancer rate limiting

**Residual Risk**: High (no API-level protection)

**Recommendation**: Implement rate limiting:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests'
});

app.use('/api/login', limiter);
app.use('/api/password-reset', limiter);
```

### Threat: Payment Fraud

**Attack Vector**: Attacker modifies order/payment data

**Mitigation**:
- ✓ Payments validated at authorization level
- ✓ Order integrity checks (amount not modified client-side)
- ⚠️ Payment processor validation needed (external)
- ⚠️ No PCI-DSS compliance (payment data handling)

**Residual Risk**: High (depends on payment processor)

**Recommendation**: 
- Use PCI-DSS compliant payment processor (Stripe, PayPal)
- Store payment tokens only, not card data
- No credit card numbers in logs

## Compliance

### GDPR (General Data Protection Regulation)

**Current Status**: ⚠️ **Partially Compliant**

**Implemented**:
- ✓ User consent for email
- ✓ Secure authentication
- ✓ Audit logging
- ✓ Data isolation by organization

**Not Implemented**:
- ✗ Data export (RTBF - Right to Be Forgotten)
- ✗ Encryption at rest
- ✗ Data processing agreements with Cloudinary
- ✗ Privacy policy enforcement

**Recommendations**:
1. Implement user data export API
2. Implement user deletion with cascading cleanup
3. Add GDPR consent management
4. Encrypt sensitive PII at rest
5. Update Cloudinary agreement for EU compliance

### PCI-DSS (Payment Card Industry Data Security Standard)

**Current Status**: ⚠️ **Not Compliant**

**Risk**: If storing card data in database

**Recommendations**:
1. Never store full credit card numbers
2. Use payment processor (Stripe) for card tokenization
3. Store only payment tokens in database
4. Implement 3D Secure for card verification
5. Regular security audits

## Implementation Checklist

### Phase 1: Current (Implemented ✓)
- [x] Email-based authentication
- [x] Argon2 password hashing
- [x] Session token management
- [x] RBAC with 3 roles
- [x] Multi-tenant isolation via middleware
- [x] Query-level tenant filtering
- [x] Audit logging (CREATE, UPDATE, DELETE)
- [x] HTTPS enforcement (in deployment)
- [x] HttpOnly, Secure, SameSite cookies
- [x] Parameterized queries (Prisma)
- [x] Email verification tokens

### Phase 2: Recommended (Not Implemented ⚠️)
- [ ] Rate limiting on auth endpoints
- [ ] Rate limiting on API endpoints
- [ ] Data export API (GDPR RTBf)
- [ ] User deletion API (GDPR)
- [ ] Encryption at rest for sensitive fields
- [ ] Row-level security (PostgreSQL)
- [ ] DOMPurify for user content
- [ ] CSRF tokens (defense-in-depth)
- [ ] API key authentication (for service-to-service)
- [ ] Two-factor authentication (2FA)
- [ ] Security headers (CSP, X-Frame-Options, etc.)
- [ ] Regular penetration testing

### Phase 3: Future (Advanced)
- [ ] Zero-trust architecture
- [ ] End-to-end encryption for sensitive data
- [ ] Blockchain for immutable audit logs
- [ ] Hardware security modules (HSM)
- [ ] Formal threat modeling (STRIDE)

## Security Headers

**Current Implementation**:
```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

**Recommended Enhancements**:
```typescript
// Content-Security-Policy
res.setHeader('Content-Security-Policy', 
  "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' https:; style-src 'self' 'unsafe-inline'"
);

// Referrer-Policy
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

// Permissions-Policy
res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
```

## Security Testing

### Manual Testing Checklist

- [ ] Try accessing another organization's courses (should fail)
- [ ] Try accessing course with invalid courseId (404, not error)
- [ ] Try bypassing authentication (direct API call without token)
- [ ] Try modifying request body (malicious data)
- [ ] Try SQL injection in search queries
- [ ] Try XSS payload in course title
- [ ] Test password reset email (secure link generation)
- [ ] Test session timeout (logout after 24 hours)
- [ ] Test concurrent logins (multiple sessions)
- [ ] Test role-based access (instructor cannot delete course)

### Automated Testing

**Unit Tests**:
```typescript
describe('Authorization', () => {
  it('should prevent non-admin from deleting course', async () => {
    const course = await createCourse(organizationId);
    const studentSession = createSession(studentUser);
    
    const response = await deleteCourse(course.id, studentSession);
    expect(response.status).toBe(403);
  });
  
  it('should prevent accessing another org course', async () => {
    const course = await createCourse('org-a');
    const sessionOrgB = createSession(userOrgB);
    
    const response = await getCourse(course.id, sessionOrgB);
    expect(response.status).toBe(404);
  });
});
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Argon2 Algorithm](https://github.com/P-H-C/phc-winner-argon2)
- [Prisma Security](https://www.prisma.io/docs/orm/more/security)
- [GDPR Compliance Guide](https://gdpr-info.eu/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)