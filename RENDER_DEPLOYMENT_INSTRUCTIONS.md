# Render Backend Deployment Instructions - Authentication Fix

## Critical Issue

The production backend is currently setting `SameSite=Lax` cookies, which prevents cross-origin authentication from working. Users are redirected to the landing page after login because `/api/v1/auth/me` returns 401.

## Required Actions

### 1. Set Environment Variable on Render (CRITICAL)

**This is the most important step and must be done before deploying code changes.**

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Navigate to your backend service: `learn-flow-1-1gl3` (or whatever it's named)
3. Go to **Environment** tab
4. Add or update the following environment variable:

   ```
   Key: SESSION_COOKIE_SECURE
   Value: true
   ```

5. **Verify** the following variables are also set:

   ```
   CORS_ALLOWED_ORIGINS=https://learn-flow-web-indol.vercel.app
   NODE_ENV=production
   ```

6. Click **Save Changes**

### 2. Deploy Code Changes

After setting the environment variable, deploy the updated code:

```bash
git add .
git commit -m "Fix: Set SameSite=None cookies for cross-origin authentication"
git push origin main
```

Render will automatically deploy the new code.

### 3. Verify Deployment

After deployment completes (usually 2-5 minutes), verify the fix:

#### A. Check Server Logs

In Render dashboard → Logs, you should see on startup:

```
API server listening on http://localhost:<port>
Environment: production
Session cookie mode: Secure (SameSite=None)
CORS allowed origins: https://learn-flow-web-indol.vercel.app
```

If you see `Insecure (SameSite=Lax, localhost only)`, then `SESSION_COOKIE_SECURE` is not set correctly.

#### B. Test Login Endpoint

```bash
curl -i -X POST https://learn-flow-1-1gl3.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://learn-flow-web-indol.vercel.app" \
  -d '{"email":"admin@gmail.com","password":"<your-admin-password>"}'
```

**Expected Set-Cookie header:**
```
Set-Cookie: learnflow_session=...; Max-Age=604800; Path=/; Expires=...; HttpOnly; Secure; SameSite=None
```

**Key verification points:**
- ✓ `SameSite=None` (NOT `SameSite=Lax`)
- ✓ `Secure` flag present
- ✓ `HttpOnly` flag present

#### C. Test Frontend Login Flow

1. Open https://learn-flow-web-indol.vercel.app
2. Click "Login"
3. Enter valid credentials
4. **Expected:** User is redirected to the appropriate dashboard and stays there
5. Refresh the page
6. **Expected:** User remains authenticated (no redirect to login or home)

#### D. Browser DevTools Verification

1. Open browser DevTools (F12)
2. Go to Network tab
3. Log in
4. Find `POST /api/v1/auth/login` request:
   - Check Response Headers for `Set-Cookie` with `SameSite=None`
5. Find subsequent `GET /api/v1/auth/me` request:
   - Status should be **200** (not 401)
   - Request Headers should include `Cookie: learnflow_session=...`
6. Go to Application/Storage tab → Cookies → `learn-flow-1-1gl3.onrender.com`
   - Verify cookie exists with:
     - SameSite: `None`
     - Secure: ✓
     - HttpOnly: ✓

## What Changed

### Code Changes

1. **`apps/api/src/controllers/authController.ts`**
   - Added clarifying comments about SameSite=None requirement for cross-origin
   - Logic unchanged (already correct)

2. **`apps/api/src/server.ts`**
   - Added startup logging to show cookie security mode and CORS origins
   - Helps diagnose configuration issues

3. **`.env.example`**
   - Added documentation about when to set `SESSION_COOKIE_SECURE=true`

4. **Documentation:**
   - `PRODUCTION_AUTH_FIX.md` - Complete technical explanation
   - `RENDER_DEPLOYMENT_INSTRUCTIONS.md` - This file

### Why This Fix Works

**Before:**
- `COOKIE_SECURE` was `false` (because neither `NODE_ENV=production` nor `SESSION_COOKIE_SECURE=true` was set)
- Cookies were set with `SameSite=Lax`
- Browsers blocked cookies from being sent cross-origin
- `/auth/me` returned 401
- User was redirected to landing page

**After:**
- `SESSION_COOKIE_SECURE=true` is set on Render
- `COOKIE_SECURE` evaluates to `true`
- Cookies are set with `SameSite=None; Secure`
- Browsers accept and send cookies cross-origin
- `/auth/me` returns 200
- User stays on dashboard

## Troubleshooting

### Issue: Still seeing `SameSite=Lax` after deployment

**Cause:** `SESSION_COOKIE_SECURE` environment variable not set on Render

**Fix:**
1. Double-check Render dashboard → Environment variables
2. Ensure key is exactly `SESSION_COOKIE_SECURE` (case-sensitive)
3. Ensure value is exactly `true` (lowercase)
4. Save and wait for automatic redeploy

### Issue: Cookie not being sent by browser

**Cause:** CORS configuration

**Fix:**
1. Verify `CORS_ALLOWED_ORIGINS` includes your exact Vercel URL
2. Check for trailing slashes (URL should NOT have trailing slash)
3. Verify frontend `NEXT_PUBLIC_API_URL` matches backend URL exactly

### Issue: 403 CSRF_ORIGIN_REJECTED

**Cause:** Frontend origin not in allowed origins list

**Fix:**
Add frontend URL to `CORS_ALLOWED_ORIGINS`:
```
CORS_ALLOWED_ORIGINS=https://learn-flow-web-indol.vercel.app
```

### Issue: Still getting 401 on /auth/me

**Possible causes:**
1. Cookie with `SameSite=Lax` is cached in browser
   - Clear cookies for backend domain
   - Try in incognito/private window
2. Database session expired
   - Log in again to create new session
3. Redis connection issue
   - Check Render logs for Redis errors
4. Database connection issue
   - Check Render logs for Prisma errors

## Rollback Plan

If the fix causes issues:

1. Revert environment variable on Render:
   ```
   SESSION_COOKIE_SECURE=false
   ```
   (Note: This will only work for same-origin deployments)

2. Revert code changes:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Production Checklist

Before marking this as complete, verify:

- [ ] `SESSION_COOKIE_SECURE=true` is set on Render
- [ ] Code changes are deployed to Render
- [ ] Server logs show "Session cookie mode: Secure (SameSite=None)"
- [ ] Test login returns `Set-Cookie` with `SameSite=None`
- [ ] Frontend login flow works end-to-end
- [ ] User stays authenticated after refresh
- [ ] Dashboard pages load without redirect
- [ ] `/auth/me` returns 200 (not 401)
- [ ] Browser DevTools shows cookie with `SameSite: None`
- [ ] No CORS or CSRF errors in browser console
- [ ] Admin dashboard accessible at `/dashboard`
- [ ] Organization admin dashboard accessible at `/dashboard/organization`
- [ ] Instructor dashboard accessible at `/dashboard/instructor`
- [ ] Student dashboard accessible at `/dashboard/student/search`

## Next Steps After Fix

1. **Monitor production logs** for any authentication errors
2. **Test all user roles** (PLATFORM_ADMIN, ORG_ADMIN, INSTRUCTOR, STUDENT)
3. **Verify logout** clears session and redirects correctly
4. **Test password reset flow** (email should still work)
5. **Test registration flow** (new users should be able to sign up)

## Additional Resources

- [MDN: SameSite cookies explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Chrome SameSite cookie changes](https://web.dev/samesite-cookies-explained/)
- [Render Environment Variables](https://render.com/docs/environment-variables)

## Support

If issues persist after following these instructions:

1. Check Render logs for errors
2. Check browser console for CORS/cookie errors
3. Verify all environment variables are set correctly
4. Test with curl/Postman to isolate browser issues
5. Check database/Redis connectivity
