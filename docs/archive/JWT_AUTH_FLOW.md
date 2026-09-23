# JWT Authentication Flow for Talk Rooms

## Overview

Implemented **Plan 5B: JWT Verification** to enable fast, secure Talk room access without requiring users to be logged in to both inner-gathering AND admin apps.

## How It Works

### Traditional OAuth Flow (OLD - Slow)
1. User clicks Talk link in inner-gathering
2. Redirects to Nextcloud Social Login
3. Social Login → admin OIDC `/api/oidc/authorize`
4. **Admin checks session → User NOT logged in**
5. **Redirects to admin login page (6-30 seconds to compile)**
6. User logs in to admin
7. OAuth continues → Talk room

**Problem:** User must be logged in to BOTH apps, causing slow redirects.

### JWT + OAuth Flow (NEW - Fast)
1. User clicks Talk link in inner-gathering (MUST be logged in)
2. inner-gathering checks user session
3. **Creates signed JWT with user identity (5min expiry)**
4. Redirects to Nextcloud Social Login with JWT in `login_hint` parameter
5. Social Login → admin OIDC `/api/oidc/authorize?login_hint=<JWT>`
6. **Admin verifies JWT signature → extracts user ID (NO session check needed)**
7. Creates OAuth code for verified user
8. Back to Nextcloud → Talk room

**Benefits:**
- ✅ Fast - no admin login required
- ✅ Secure - JWT is cryptographically signed
- ✅ Correct user guaranteed - JWT contains verified user identity
- ✅ Works with existing OAuth flow

## Implementation Details

### 1. Environment Variables

Added `INTER_APP_JWT_SECRET` to both admin and inner-gathering:

```yaml
# docker-compose.yml
admin:
  environment:
    INTER_APP_JWT_SECRET: ${INTER_APP_JWT_SECRET:-2tUAlTGY3CvoVysKpy/qaokFwj+NmS3K6+CaXiC+58I=}

inner-gathering:
  environment:
    INTER_APP_JWT_SECRET: ${INTER_APP_JWT_SECRET:-2tUAlTGY3CvoVysKpy/qaokFwj+NmS3K6+CaXiC+58I=}
```

### 2. Talk Join Route (inner-gathering)

**File:** `apps/inner-gathering/src/app/api/talk/join/route.ts`

**Key changes:**
- ✅ Checks user is logged in to inner-gathering
- ✅ Verifies user is synced to Nextcloud
- ✅ Creates signed JWT with user identity
- ✅ Passes JWT as `login_hint` parameter to OAuth flow

**JWT Payload:**
```typescript
{
  userId: user.id,
  email: user.email,
  displayName: user.display_name,
  nextcloudUserId: user.nextcloud_user_id,
  iss: 'inner-gathering',
  aud: 'admin-oidc',
  exp: <5 minutes from now>
}
```

### 3. OIDC Authorize Endpoint (admin)

**File:** `apps/admin/src/app/api/oidc/authorize/route.ts`

**Key changes:**
- ✅ Accepts `login_hint` parameter containing JWT
- ✅ Verifies JWT signature using shared secret
- ✅ Extracts user ID from verified JWT
- ✅ Falls back to session check if no JWT provided (backwards compatible)

**JWT Verification:**
```typescript
import { jwtVerify } from 'jose';

const { payload } = await jwtVerify(loginHint, secret, {
  issuer: 'inner-gathering',
  audience: 'admin-oidc',
});

userId = payload.userId as string;
```

## Security Considerations

### ✅ Secure
- JWT is signed with HS256 algorithm
- Secret is shared between apps via environment variable (not exposed)
- JWT expires in 5 minutes (short-lived)
- JWT is validated before use (signature + issuer + audience checks)
- User must be logged in to inner-gathering first

### ⚠️ Considerations
- JWT appears in URL (visible in logs/browser history)
  - Mitigated by: short expiry (5min), HTTPS in production
- Shared secret between apps
  - Mitigated by: secure environment variable management
- Custom approach (not standard OAuth)
  - Trade-off: Better UX vs standard compliance

## Testing

### 1. Verify Environment Variables
```bash
docker compose exec admin sh -c 'echo $INTER_APP_JWT_SECRET'
docker compose exec inner-gathering sh -c 'echo $INTER_APP_JWT_SECRET'
# Both should output the same secret
```

### 2. Test Talk Room Link
1. Log in to inner-gathering at http://localhost:3004
2. Ensure your account is synced to Nextcloud (check /account page)
3. Click a Talk room link
4. Should redirect to Talk room WITHOUT admin login prompt
5. Should complete in <3 seconds (vs 6-30 seconds before)

### 3. Check Logs
```bash
# Watch OIDC authorize endpoint logs
docker compose logs admin -f | grep "oidc/authorize"

# You should see:
# [oidc/authorize] Authenticated via JWT for user: <user-id>
```

### 4. Test Fallback (Session Check)
1. Call OIDC endpoint directly without JWT:
```bash
curl "http://localhost:3000/api/oidc/authorize?client_id=nextcloud&redirect_uri=http://192.168.0.24:8080/apps/sociallogin/custom_oauth2/elkdonis&response_type=code&scope=openid"
```
2. Should redirect to login page (fallback behavior)

## Troubleshooting

### Issue: "invalid_login_hint" error
**Cause:** JWT verification failed
**Solutions:**
- Check INTER_APP_JWT_SECRET is the same in both apps
- Check JWT hasn't expired (only 5min lifetime)
- Check inner-gathering created the JWT correctly

### Issue: "user_not_found" error
**Cause:** User doesn't exist in database
**Solution:** Ensure user account exists in `public.users` table

### Issue: Still redirecting to admin login
**Cause:** JWT not being passed or inner-gathering not creating JWT
**Solutions:**
- Check inner-gathering logs: `docker compose logs inner-gathering`
- Verify user is logged in to inner-gathering
- Verify user is synced to Nextcloud

### Issue: Talk room still slow
**Cause:** Different issue (Nextcloud, network, etc.)
**Solution:** Check Nextcloud logs and network latency

## Future Enhancements

1. **Move to POST with body parameter** (instead of JWT in URL)
   - More secure (JWT not in logs)
   - Requires modifying Social Login flow

2. **Implement session sharing (Plan 2A)**
   - Better long-term solution
   - Requires domain setup with subdirectories or subdomains

3. **Add JWT refresh mechanism**
   - Extend JWT lifetime automatically
   - Reduce repeated authentications

4. **Add rate limiting**
   - Prevent JWT abuse
   - Protect OIDC endpoint

## Files Modified

1. `docker-compose.yml` - Added INTER_APP_JWT_SECRET env var
2. `.env.example` - Documented JWT secret requirement
3. `apps/inner-gathering/src/app/api/talk/join/route.ts` - Create JWT
4. `apps/inner-gathering/package.json` - Added `jose` dependency
5. `apps/admin/src/app/api/oidc/authorize/route.ts` - Verify JWT
6. `apps/admin/package.json` - Added `jose` dependency

## Rollback

To revert to simple flow (no session/JWT checks):

```bash
git checkout apps/inner-gathering/src/app/api/talk/join/route.ts
git checkout apps/admin/src/app/api/oidc/authorize/route.ts
docker compose restart inner-gathering admin
```

Note: This removes security but is fastest for testing.
