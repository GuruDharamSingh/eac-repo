# Talk Room Auth Flow Analysis

## Overview
The GitHub repo implements a sophisticated **cross-app Single Sign-On (SSO)** flow that allows users logged into `inner-gathering` (port 3004) to seamlessly join Nextcloud Talk rooms by leveraging the `admin` app (port 3000) as an **OAuth2/OIDC identity provider**.

---

## The Flow Step-by-Step

### 1. User Clicks "Join Talk Room" Button
**File:** `apps/inner-gathering/src/components/meeting-card.tsx:295`

```tsx
<Menu.Item
  component="a"
  href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
  target="_blank"
  leftSection={<Video size={14} />}
>
  Join Talk Room
</Menu.Item>
```

The button links to the inner-gathering API route with the Nextcloud Talk room token.

---

### 2. Inner-Gathering Creates Signed JWT
**File:** `apps/inner-gathering/src/app/api/talk/join/route.ts`

**What it does:**
1. Verifies user is logged into inner-gathering
2. Checks user has synced Nextcloud account
3. Creates a **signed JWT** containing user identity
4. Sets JWT as httpOnly cookie (`eac_user_jwt`)
5. Redirects to Nextcloud Social Login

**Key Code:**
```typescript
// Create signed JWT with 5-minute expiry
const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
const userToken = await new SignJWT({
  userId: user.id,
  email: user.email,
  displayName: user.display_name,
  nextcloudUserId: user.nextcloud_user_id,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('5m') // Short-lived for security
  .setIssuer('inner-gathering')
  .setAudience('admin-oidc')
  .sign(secret);

// Redirect to Nextcloud Social Login OAuth2 flow
const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
socialLoginUrl.searchParams.set('login_redirect_url', talkUrl);

// Set JWT as secure cookie
response.cookies.set('eac_user_jwt', userToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 300, // 5 minutes
  path: '/',
});
```

**Redirect URL:**
```
http://localhost:8080/apps/sociallogin/custom_oauth2/elkdonis?login_redirect_url=http://localhost:8080/call/ROOM_TOKEN
```

---

### 3. Nextcloud Social Login Initiates OAuth2 Flow
Nextcloud's Social Login app detects the custom OAuth2 provider (`elkdonis`) and initiates OAuth2 authorization:

**Nextcloud redirects to:**
```
http://localhost:3000/api/oidc/authorize?
  client_id=nextcloud&
  redirect_uri=http://localhost:8080/apps/sociallogin/custom_oauth2/elkdonis&
  response_type=code&
  scope=openid email profile&
  state=...
```

**Why port 3000?**  
The admin app (running on port 3000) is configured as the **OpenID Connect Provider**. Nextcloud was configured to trust `http://localhost:3000` as its identity provider.

---

### 4. Admin App Acts as OIDC Provider
**File:** `apps/admin/src/app/api/oidc/authorize/route.ts`

**Discovery Endpoint:** `apps/admin/src/app/.well-known/openid-configuration/route.ts`
```json
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/api/oidc/authorize",
  "token_endpoint": "http://localhost:3000/api/oidc/token",
  "userinfo_endpoint": "http://localhost:3000/api/oidc/userinfo"
}
```

**Authorization Logic:**
1. Reads the JWT from cookie (`eac_user_jwt`)
2. Verifies JWT signature using `INTER_APP_JWT_SECRET`
3. Extracts user ID from JWT payload
4. Generates OAuth2 authorization code
5. Redirects back to Nextcloud with the code

**Key Code:**
```typescript
// Read JWT from cookie (set by inner-gathering)
const cookieJwt = req.cookies.get('eac_user_jwt')?.value;

if (cookieJwt) {
  // Verify JWT from inner-gathering
  const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
  const { payload } = await jwtVerify(cookieJwt, secret, {
    issuer: 'inner-gathering',
    audience: 'admin-oidc',
  });

  userId = payload.userId as string;
  console.log('[oidc/authorize] ✅ Authenticated via JWT for user:', userId);
}

// Generate auth code
const code = await createAuthCode(user.id, clientId, redirectUri, { nonce, ... });

// Redirect back to Nextcloud
return NextResponse.redirect(`${redirectUri}?code=${code}&state=${state}`);
```

---

### 5. Nextcloud Exchanges Code for Token
**File:** `apps/admin/src/app/api/oidc/token/route.ts`

Nextcloud sends a POST request to exchange the authorization code for an ID token:

```http
POST http://localhost:3000/api/oidc/token
Content-Type: application/x-www-form-urlencoded

code=AUTHORIZATION_CODE&
client_id=nextcloud&
client_secret=NEXTCLOUD_OIDC_SECRET&
redirect_uri=http://localhost:8080/apps/sociallogin/custom_oauth2/elkdonis&
grant_type=authorization_code
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "eyJhbGc..." // JWT with user identity
}
```

**ID Token Payload:**
```json
{
  "sub": "user-uuid",
  "name": "Display Name",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "http://localhost:3000",
  "aud": "nextcloud",
  "exp": 1234567890
}
```

---

### 6. Nextcloud Logs User In
Nextcloud's Social Login plugin:
1. Validates the ID token signature
2. Creates/updates the Nextcloud user session
3. Redirects to the original Talk room URL

**Final redirect:**
```
http://localhost:8080/call/ROOM_TOKEN
```

User is now logged into Nextcloud AND in the Talk room! 🎉

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Join Talk Room" in inner-gathering (port 3004)         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. /api/talk/join creates signed JWT with user identity                │
│    - Sets JWT as httpOnly cookie (eac_user_jwt)                        │
│    - Redirects to Nextcloud Social Login                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Nextcloud Social Login (port 8080)                                  │
│    - Initiates OAuth2 flow with admin app                              │
│    - Redirects to: http://localhost:3000/api/oidc/authorize            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Admin App OIDC Provider (port 3000)                                 │
│    - Reads JWT from cookie                                             │
│    - Verifies JWT signature with INTER_APP_JWT_SECRET                  │
│    - Generates OAuth2 authorization code                               │
│    - Redirects back to Nextcloud with code                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Nextcloud exchanges code for ID token                               │
│    - POST http://localhost:3000/api/oidc/token                         │
│    - Validates client_secret (NEXTCLOUD_OIDC_SECRET)                   │
│    - Returns ID token with user identity                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Nextcloud creates user session and redirects to Talk room           │
│    - User is now logged into Nextcloud!                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### Environment Variables Required

**`.env` (shared):**
```bash
# Shared secret between inner-gathering and admin app
INTER_APP_JWT_SECRET=<generate-with-openssl-rand-base64-32>

# OIDC client secret (shared with Nextcloud Social Login config)
NEXTCLOUD_OIDC_SECRET=<random-secret>

# Admin app URL (where OIDC provider runs)
ADMIN_URL=http://localhost:3000

# Nextcloud public URL
NEXT_PUBLIC_NEXTCLOUD_URL=http://localhost:8080
```

### OIDC Client Configuration
**File:** `apps/admin/src/lib/oidc.ts`

```typescript
export const CLIENTS: Record<string, OidcClient> = {
  'nextcloud': {
    id: 'nextcloud',
    secret: process.env.NEXTCLOUD_OIDC_SECRET,
    redirectUris: [
      'http://localhost:8080/apps/sociallogin/custom_oauth2/elkdonis',
      'http://localhost:8080/apps/sociallogin/custom_oidc/elkdonis',
      // Production URLs from env vars...
    ],
    name: 'Nextcloud'
  }
};
```

### Nextcloud Social Login Configuration

In Nextcloud Admin Settings → Social Login:

**Provider Type:** Custom OAuth2  
**Provider Name:** `elkdonis`  
**Client ID:** `nextcloud`  
**Client Secret:** `<NEXTCLOUD_OIDC_SECRET from .env>`  
**Authorize URL:** `http://localhost:3000/api/oidc/authorize`  
**Token URL:** `http://localhost:3000/api/oidc/token`  
**User Info URL:** `http://localhost:3000/api/oidc/userinfo`  
**Discovery URL:** `http://localhost:3000/.well-known/openid-configuration`

---

## Security Features

### 1. Short-lived JWT (5 minutes)
The JWT created by inner-gathering expires in 5 minutes, limiting the window for potential misuse.

### 2. httpOnly Cookies
The JWT is stored in an httpOnly cookie, preventing JavaScript access and XSS attacks.

### 3. Signed JWTs
All JWTs are signed with `INTER_APP_JWT_SECRET`, preventing tampering.

### 4. One-time Authorization Codes
OAuth2 codes are deleted after use, preventing replay attacks.

### 5. PKCE Support
The OIDC implementation supports PKCE (Proof Key for Code Exchange) for additional security.

### 6. Audience Validation
JWTs specify `audience: 'admin-oidc'` to prevent token reuse in other contexts.

---

## Why Port 3000?

The **admin app on port 3000** acts as the **OAuth2/OIDC identity provider** because:

1. **Centralized User Database:** Admin app has access to the shared user database
2. **OIDC Infrastructure:** Already implements OAuth2/OIDC endpoints
3. **Trust Anchor:** Nextcloud is configured to trust `http://localhost:3000` as its SSO provider
4. **Cross-App Auth:** Enables SSO between all apps (blog, forum, inner-gathering) and Nextcloud

**Production Setup:**  
In production, you'd use a public domain like `https://admin.yourdomain.com` instead of localhost:3000.

---

## Benefits of This Approach

✅ **Seamless UX:** Users click "Join Talk" and are instantly in the room  
✅ **No Re-login:** Users already logged into inner-gathering don't need to log in again  
✅ **Secure:** Uses industry-standard OAuth2/OIDC with signed JWTs  
✅ **Scalable:** Can extend to other Nextcloud apps (Files, Calendar, etc.)  
✅ **Centralized Identity:** Single source of truth for user authentication  

---

## Testing the Flow

### 1. Verify Environment Variables
```bash
grep -E "INTER_APP_JWT_SECRET|NEXTCLOUD_OIDC_SECRET|ADMIN_URL" .env
```

### 2. Ensure Admin App is Running
```bash
curl http://localhost:3000/.well-known/openid-configuration
```

### 3. Check Nextcloud Social Login Config
Go to Nextcloud → Settings → Social Login → Custom OAuth2 → elkdonis

### 4. Test the Flow
1. Log into inner-gathering at http://localhost:3004
2. Find a meeting with a Talk room
3. Click "Join Talk Room" in the menu
4. Watch the redirects in browser DevTools Network tab
5. You should land in the Talk room, logged in!

---

## Troubleshooting

### "JWT verification failed"
- Check `INTER_APP_JWT_SECRET` matches in both apps
- Verify JWT hasn't expired (5 min limit)

### "Invalid client"
- Verify `NEXTCLOUD_OIDC_SECRET` matches between .env and Nextcloud config

### "User not synced"
- User needs Nextcloud account provisioned
- Check `users.nextcloud_synced = true` in database

### Redirect loops
- Clear cookies
- Check `ADMIN_URL` is accessible from browser
- Verify Nextcloud Social Login redirect URIs include the admin URL

---

## Comparison to Your Local Setup

Your current setup uses **Nextcloud AIO**, which runs on:
- Port: `11000` (Apache)
- Container: `nextcloud-aio-apache`

The GitHub repo uses:
- Port: `8080` (nginx)
- Generic Docker Nextcloud

**To adapt for your server:**
Update `.env`:
```bash
NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.elkdonis-arts.org
NEXTCLOUD_URL=http://nextcloud-aio-apache:11000

# Production admin URL (accessible publicly)
ADMIN_URL=https://admin.yourdomain.com  # Or http://YOUR_IP:3000
```

Update Nextcloud Social Login to use your production admin URL.
