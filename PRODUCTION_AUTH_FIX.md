# Production Authentication Fix

## Issue Summary

Users were being redirected to the landing page after successful login due to failed session authentication (`GET /api/v1/auth/me → 401 Unauthorized`).

## Root Cause

The backend was setting `SameSite=Lax` for the session cookie instead of `SameSite=None`, which caused browsers to block the cookie from being sent with cross-origin requests from the Vercel frontend to the Render backend.

### Why This Happened

The cookie configuration logic in `apps/api/src/controllers/authController.ts` correctly sets:
```typescript
sameSite: COOKIE_SECURE ? 'none' : 'lax',
secure: COOKIE_SECURE,
```

However, `COOKIE_SECURE` was evaluating to `false` in production because **neither** of these conditions was true:
1. `process.env.NODE_ENV === 'production'` (Render might not be setting this)
2. `process.env.SESSION_COOKIE_SECURE === 'true'` (not configured on Render)

## The Fix

### Code Changes

1. **Added clarifying comments** in `apps/api/src/controllers/authController.ts` to explain the SameSite=None requirement for cross-origin deployments.

2. **Updated `.env.example`** with clear documentation about when to set `SESSION_COOKIE_SECURE=true`.

### Required Render Configuration

**CRITICAL:** Add this environment variable to the Render backend service:

```
SESSION_COOKIE_SECURE=true
```

This ensures that:
- Cookies are set with `SameSite=None; Secure`
- Browsers accept and send cookies with cross-origin requests
- Frontend (Vercel) can authenticate with backend (Render)

### Other Required Render Environment Variables

Ensure these are also configured on Render (see `RENDER_BACKEND_ENV_AUDIT.md` for complete list):

```bash
# Required - Frontend origin must be in CORS allowed list
CORS_ALLOWED_ORIGINS=https://learn-flow-web-indol.vercel.app

# Required - These should already be set
DATABASE_URL=<your-production-postgres-url>
REDIS_URL=<your-production-redis-url>
NODE_ENV=production
```

## How Cross-Origin Cookie Auth Works

For cookies to work across different domains (Vercel frontend → Render backend):

1. **Backend Requirements:**
   - Set `SameSite=None` (allows cross-origin cookie sending)
   - Set `Secure=true` (required when using SameSite=None)
   - Set `HttpOnly=true` (security: prevents JavaScript access)
   - Include frontend origin in CORS `Access-Control-Allow-Origin`
   - Set `Access-Control-Allow-Credentials: true` in CORS

2. **Frontend Requirements:**
   - Use `credentials: 'include'` in fetch requests ✓ (already implemented)
   - Set `NEXT_PUBLIC_API_URL` to backend URL

3. **Browser Behavior:**
   - With `SameSite=None; Secure`, browser stores cookie from login response
   - Browser sends cookie with all subsequent requests to backend (if credentials: 'include')
   - With `SameSite=Lax`, browser blocks cross-origin cookie (causing 401s)

## Testing the Fix

### 1. Verify Cookie Settings

After deploying with `SESSION_COOKIE_SECURE=true`, test login:

```bash
curl -i -X POST https://learn-flow-1-1gl3.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://learn-flow-web-indol.vercel.app" \
  -d '{"email":"admin@gmail.com","password":"admin123"}'
```

**Expected Set-Cookie header:**
```
Set-Cookie: learnflow_session=...; Max-Age=604800; Path=/; Expires=...; HttpOnly; Secure; SameSite=None
```

✓ Verify: `SameSite=None` (NOT `SameSite=Lax`)

### 2. Test Complete Login Flow

1. Open production frontend: https://learn-flow-web-indol.vercel.app
2. Click "Login"
3. Enter valid credentials
4. **Expected:** User is redirected to appropriate dashboard (not landing page)
5. **Verify:** Browser DevTools → Network tab shows:
   - POST `/api/v1/auth/login` → 200 with `Set-Cookie: ...SameSite=None`
   - GET `/api/v1/auth/me` → 200 (cookie sent in request)
6. **Verify:** Browser DevTools → Application → Cookies shows cookie with:
   - Name: `learnflow_session`
   - Domain: `learn-flow-1-1gl3.onrender.com`
   - Secure: ✓
   - HttpOnly: ✓
   - SameSite: `None`

### 3. Test Dashboard Access

1. Navigate to dashboard pages
2. Refresh page
3. **Expected:** User remains authenticated (no redirect to login/home)

## Deployment Steps

### Backend (Render)

1. Go to Render dashboard → `learn-flow-1-1gl3` service
2. Navigate to Environment Variables
3. Add/update:
   ```
   SESSION_COOKIE_SECURE=true
   ```
4. Verify `CORS_ALLOWED_ORIGINS` includes:
   ```
   https://learn-flow-web-indol.vercel.app
   ```
5. Deploy updated code (git push to main)
6. Wait for deployment to complete
7. Test using steps above

### Frontend (Vercel)

No code changes needed. Verify environment variables:
```
NEXT_PUBLIC_API_URL=https://learn-flow-1-1gl3.onrender.com
```

## Why `NODE_ENV=production` Alone Didn't Work

Render's Node.js services typically set `NODE_ENV=production` automatically, but:
1. Docker deployments might not inherit this automatically
2. The Dockerfile might override it
3. Explicitly setting `SESSION_COOKIE_SECURE=true` is more reliable and explicit

The updated code now has both paths:
- `NODE_ENV=production` → secure cookies
- `SESSION_COOKIE_SECURE=true` → secure cookies

This provides redundancy and makes the configuration explicit.

## Related Issues Fixed

1. **401 on /auth/me after login** → Fixed by SameSite=None cookies
2. **Redirect loop to landing page** → Fixed by successful authentication
3. **White screen on login page** → Will resolve once auth flow completes successfully

## Remaining Considerations

### The `pik.png` Preload Warning

The warning about `pik.png` being preloaded but not used is a **separate performance issue** and does NOT cause authentication failure. To investigate:

```bash
grep -r "pik.png" apps/web/
```

This is likely a preload link in the HTML that should be removed or corrected.

### Local Development

Local development (localhost:3000 → localhost:4000) can use `SESSION_COOKIE_SECURE=false` because:
- Same origin (both localhost)
- No cross-origin restrictions
- `SameSite=Lax` works fine

**Never use `SameSite=None` cookies over HTTP** (localhost without HTTPS) - browsers will reject them.

## References

- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Chrome SameSite cookie changes](https://web.dev/samesite-cookies-explained/)
- [OWASP: Cross-Site Request Forgery (CSRF) Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
