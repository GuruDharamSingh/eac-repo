# Nextcloud Customizations to Preserve

## Summary
These customizations were made to connect to the Nextcloud AIO (All-In-One) instance on this server.
**MUST PRESERVE** these changes when merging from GitHub repo.

## File: packages/nextcloud/src/client.ts

**Line 120 - Custom Nextcloud URL:**
```typescript
// CUSTOM - Points to Nextcloud AIO Apache container
const url = baseUrl || process.env.NEXTCLOUD_URL || 'http://nextcloud-aio-apache:11000';

// GitHub repo uses different default:
// const url = baseUrl || process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80';
```

**Reason:** This server uses Nextcloud AIO which runs on Apache on port 11000, not the standard nginx setup.

---

## File: packages/nextcloud/src/users.ts

**Added Functions (after line 38):**

### 1. deriveNextcloudUsername
```typescript
/**
 * Derive a Nextcloud-compatible username from an email address.
 * Rules: lowercase, letters and numbers only.
 * Example: "Justin.GillisB@gmail.com" → "justingillisb"
 */
function deriveNextcloudUsername(email: string): string {
  const local = email.split('@')[0] || email;
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');     // letters and numbers only
}
```

### 2. findNcUserByEmail
```typescript
/**
 * Find an existing Nextcloud user by email address.
 * Returns their userid if found, null otherwise.
 */
async function findNcUserByEmail(
  adminClient: NextcloudClient,
  email: string,
  allUserIds: string[]
): Promise<string | null> {
  for (const uid of allUserIds) {
    try {
      const res = await adminClient.ocs.get(`/cloud/users/${encodeURIComponent(uid)}?format=json`);
      const userData = res.data?.ocs?.data;
      if (userData?.email?.toLowerCase() === email.toLowerCase()) {
        return uid;
      }
    } catch {
      // skip users we can't fetch
    }
  }
  return null;
}
```

**Modified provisionUser function (after line 83):**
```typescript
  // Derive a Nextcloud-friendly username from the email (no spaces, lowercase)
  let ncUsername = deriveNextcloudUsername(email);

  // Check if a Nextcloud user with this email already exists (e.g. manually created)
  try {
    const listRes = await adminClient.ocs.get('/cloud/users?format=json');
    const allUsers: string[] = listRes.data?.ocs?.data?.users || [];
    const existingNcUser = await findNcUserByEmail(adminClient, email, allUsers);
    if (existingNcUser) {
      console.log(`ℹ️  Found existing Nextcloud user "${existingNcUser}" for email ${email}`);
      ncUsername = existingNcUser;
    }
  } catch {
    // Non-fatal: fall through to create attempt
  }

  // Uses ncUsername instead of userId
  formData.set('userid', ncUsername);
```

**Reason:** Enhanced user management to:
- Support email-based username derivation
- Find and link existing Nextcloud users
- Better integration with manually created Nextcloud accounts

---

## How to Apply After Merge

If merge conflicts occur, manually restore these changes:
1. Check `packages/nextcloud/src/client.ts` line ~120 for correct URL
2. Verify `packages/nextcloud/src/users.ts` has both helper functions
3. Ensure `provisionUser` uses the enhanced logic with `ncUsername`

## Environment Variables
Ensure `.env` has:
```
NEXTCLOUD_URL=http://nextcloud-aio-apache:11000
```

---

## System Config: social_login_auto_redirect (2026-07-11)

```
occ config:system:set social_login_auto_redirect --value=true --type=boolean
```

**Reason:** Talk-room SSO now routes through `/login?redirect_url=/call/<token>`
instead of hitting `/apps/sociallogin/custom_oauth2/elkdonis` directly (which
errors with "account already connected" when a Nextcloud session already
exists). With this flag, a logged-out user on /login is auto-forwarded to the
Elkdonis OIDC provider; a logged-in user is redirected straight to the target.

- Native NC login form remains reachable at `/login?noredir=1`.
- App-side changes: `apps/inner-gathering/src/app/api/talk/join/route.ts`,
  `apps/inner-gathering/src/app/api/nextcloud/redirect/route.ts`,
  `apps/arts-collective/src/app/api/talk/join/route.ts`.
- The `eac_nc_session` cookie heuristic in talk/join was removed.
