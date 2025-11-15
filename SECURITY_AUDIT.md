# Security Audit & Recommendations
**Date:** October 24, 2025
**Auditor:** Claude (AI Code Supervisor)
**Scope:** Full codebase security review

---

## Executive Summary

Overall security posture is **GOOD** with some areas requiring immediate attention. The codebase follows modern security practices including parameterized SQL queries, environment-based secrets, and proper authentication patterns. However, there are **critical vulnerabilities** around hardcoded credentials and missing authentication checks.

**Risk Level:** 🟡 MEDIUM (can be reduced to LOW with recommended fixes)

---

## ✅ STRENGTHS

### 1. SQL Injection Prevention (EXCELLENT)
- **postgres.js library** with parameterized queries throughout
- No raw SQL string concatenation found
- Template literals properly sanitized by library

**Example from events.ts:80:**
```typescript
await db`
  SELECT e.*, o.name as org_name
  FROM events e
  WHERE e.org_id = ${orgId}  // ✅ Parameterized
`;
```

**Recommendation:** Continue this pattern. Never use string concatenation for queries.

---

### 2. Authentication Architecture (GOOD)
- **Supabase GoTrue** for JWT-based auth
- User sessions managed server-side
- `is_admin` flag in database for authorization

**Files:**
- `packages/auth/src/index.ts` - Auth helpers
- `packages/services/src/auth.ts` - User management

**Recommendation:** Keep using Supabase for auth. Add middleware for protected routes.

---

### 3. Environment Variables (MOSTLY GOOD)
- `.env` files properly gitignored
- Secrets loaded via `process.env`
- Fallback values for development

**Example from db/client.ts:12:**
```typescript
const databaseUrl = process.env.DATABASE_URL || 'postgresql://...';
```

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **HARDCODED PASSWORD IN SOURCE CODE**

**Severity:** 🔴 CRITICAL
**File:** `packages/nextcloud/src/client.ts:80`

```typescript
password: process.env.NEXTCLOUD_ADMIN_PASSWORD || 'Ea4thway',
```

**Problem:**
- Password `'Ea4thway'` is hardcoded as fallback
- Appears in **7 files** across the codebase
- Password is in git history (commit `ab6058f`)
- README files contain the password in plain text

**Impact:**
- Anyone with repo access knows the admin password
- If repo is ever made public, password is exposed
- Git history can't be easily erased

**Files affected:**
```
packages/nextcloud/src/client.ts:80
packages/nextcloud/README.md:38
packages/nextcloud/PACKAGE_SUMMARY.md:88
packages/services/src/nextcloud.ts:12
apps/admin/src/lib/nextcloud/config.ts:12
apps/inner-gathering/src/app/api/media/[...path]/route.ts:5
```

**IMMEDIATE ACTION REQUIRED:**

1. **Change the password** in Nextcloud immediately
2. **Remove hardcoded fallbacks:**
   ```typescript
   // BAD
   password: process.env.NEXTCLOUD_ADMIN_PASSWORD || 'Ea4thway',

   // GOOD
   password: process.env.NEXTCLOUD_ADMIN_PASSWORD,

   // Throw error if not set
   if (!password) {
     throw new Error('NEXTCLOUD_ADMIN_PASSWORD env var required');
   }
   ```

3. **Remove from documentation:**
   - Edit README.md files to use `<your-password>` placeholder
   - Remove from PACKAGE_SUMMARY.md

4. **Consider git history cleanup** (advanced):
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch packages/nextcloud/src/client.ts" \
     --prune-empty --tag-name-filter cat -- --all
   ```
   ⚠️ Only do this if repo is not yet shared with others

---

### 2. **MISSING AUTHENTICATION CHECKS IN API ROUTES**

**Severity:** 🟠 HIGH
**Files:**
- `apps/inner-gathering/src/app/api/upload/route.ts:63`
- `apps/admin/src/app/api/moderation/route.ts:107`

**Problem:**
User IDs are accepted from client-side form data without verification:

```typescript
// ❌ INSECURE - User can fake their ID
const userId = formData.get('userId') as string;
```

**Attack scenario:**
1. Attacker inspects network requests
2. Changes `userId` in form data to another user's ID
3. Uploads files or performs actions as that user

**IMMEDIATE ACTION REQUIRED:**

Replace client-provided user IDs with server-side session verification:

```typescript
// ❌ BEFORE (insecure)
const userId = formData.get('userId') as string;

// ✅ AFTER (secure)
import { getServerAuth } from '@elkdonis/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // Get user from session
  const supabase = getServerAuth(cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const userId = user.id; // ✅ Verified from JWT

  // Rest of your code...
}
```

**Files needing fixes:**
1. `/apps/inner-gathering/src/app/api/upload/route.ts`
2. `/apps/admin/src/app/api/moderation/route.ts` (already has partial check, needs full implementation)
3. Any other API routes accepting user IDs from client

---

### 3. **ADMIN ROUTE NOT CHECKING ADMIN STATUS**

**Severity:** 🟠 HIGH
**File:** `apps/admin/src/app/api/nextcloud/sync-users/route.ts`

**Problem:**
No authentication or authorization check on admin-only endpoint:

```typescript
export async function POST() {
  // ❌ Anyone can call this
  const users = await db`SELECT * FROM users`;
  // Syncs all users to Nextcloud
}
```

**IMMEDIATE ACTION REQUIRED:**

Add admin check to ALL admin API routes:

```typescript
import { isAdmin, requireAdmin } from '@elkdonis/auth';
import { getServerAuth } from '@elkdonis/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // Get authenticated user
  const supabase = getServerAuth(cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if admin
  try {
    await requireAdmin(user.id);
  } catch (error) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  // Now proceed with admin action
  const users = await db`SELECT * FROM users`;
  // ...
}
```

**Apply to these routes:**
- `/apps/admin/src/app/api/nextcloud/*.ts` (all 5 routes)
- `/apps/admin/src/app/api/moderation/route.ts` (needs full implementation)

---

## 🟡 MEDIUM PRIORITY ISSUES

### 4. File Upload Security

**File:** `apps/inner-gathering/src/app/api/upload/route.ts`

**Current validation:** ✅ Good
- File type whitelist
- File size limits
- Filename sanitization

**Missing:**
- Content-Type verification (check actual file magic bytes, not just claimed MIME type)
- Virus scanning for self-hosted network
- Rate limiting on uploads

**Recommendation:**
```typescript
import fileType from 'file-type';

// Verify actual file type matches claimed type
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const detectedType = await fileType.fromBuffer(buffer);
if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
  return NextResponse.json(
    { error: 'Invalid file type' },
    { status: 400 }
  );
}
```

**Packages to add:**
```bash
pnpm add file-type
pnpm add express-rate-limit  # For rate limiting
```

---

### 5. Input Validation

**Missing across API routes:**
- Schema validation for request bodies
- Sanitization of user inputs before DB insertion
- Length limits on text fields

**Recommendation:** Add Zod for validation

```typescript
import { z } from 'zod';

const uploadSchema = z.object({
  file: z.instanceof(File),
  visibility: z.enum(['PUBLIC', 'ORGANIZATION', 'INVITE_ONLY']),
});

const { file, visibility } = uploadSchema.parse({
  file: formData.get('file'),
  visibility: formData.get('visibility'),
});
```

---

## 🟢 LOW PRIORITY RECOMMENDATIONS

### 6. Environment Variable Documentation

**Current:** Variables scattered across files
**Recommendation:** Create centralized `.env.example`

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elkdonis_dev

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Nextcloud (NEVER commit real passwords)
NEXTCLOUD_URL=http://localhost:8080
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=<change-me>

# Redis
REDIS_URL=redis://localhost:6379
```

---

### 7. CORS Configuration

**Check:** Are CORS headers properly set for API routes?

**Recommendation:** Add explicit CORS config in Next.js

```typescript
// next.config.ts
export default {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || 'http://localhost:3004' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};
```

---

### 8. Logging & Monitoring

**Current:** Console.log statements throughout
**Recommendation:** Structured logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['password', 'token', 'apiKey'], // Auto-redact secrets
});

// Usage
logger.info({ userId, action: 'upload' }, 'File uploaded');
logger.error({ error }, 'Upload failed');
```

---

## 📋 ACTION ITEMS CHECKLIST

### Immediate (Do Today)
- [ ] Change Nextcloud admin password
- [ ] Remove hardcoded `'Ea4thway'` password from all 7 files
- [ ] Add authentication checks to `/api/upload/route.ts`
- [ ] Add admin checks to all `/apps/admin/src/app/api/` routes
- [ ] Add `requireAdmin()` to moderation API

### This Week
- [ ] Implement server-side session verification in all API routes
- [ ] Add Zod validation to API routes
- [ ] Add file-type verification to uploads
- [ ] Create `.env.example` file
- [ ] Remove password from READMEs

### This Month
- [ ] Add rate limiting to API routes
- [ ] Implement structured logging (pino)
- [ ] Add CORS configuration
- [ ] Set up error monitoring (Sentry)
- [ ] Write security tests

---

## 🛡️ SECURITY BEST PRACTICES GOING FORWARD

### For New Code

1. **Never trust client input**
   - Validate everything
   - Check auth on every API route
   - Never accept user IDs from client

2. **Never commit secrets**
   - Use environment variables
   - No hardcoded passwords
   - Add `.env` to `.gitignore`

3. **Use parameterized queries**
   - Continue using postgres.js properly
   - Never concatenate SQL strings

4. **Log security events**
   - Failed auth attempts
   - Admin actions
   - Suspicious patterns

### Code Review Checklist

Before merging any API route:
- [ ] Authentication check present?
- [ ] Authorization check (admin/user role)?
- [ ] Input validation with Zod?
- [ ] User ID from session, not form data?
- [ ] SQL queries parameterized?
- [ ] No secrets in code?

---

## 📚 SECURITY RESOURCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/security)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

## CONCLUSION

Your codebase has solid foundations but needs immediate attention on:
1. Hardcoded password removal
2. Authentication enforcement on API routes
3. Admin authorization checks

After addressing these issues, security posture will be **EXCELLENT** for a self-hosted spiritual community network.

**Questions?** Review this document with your development team and prioritize the immediate action items.
