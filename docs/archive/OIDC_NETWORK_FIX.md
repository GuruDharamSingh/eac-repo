# OIDC Auth Flow Network Configuration Fix

## Problem Identified

The OIDC flow from inner-gathering → admin app → Nextcloud is failing due to **network isolation issues**:

### 1. Network Name Mismatch
**Current:** `docker-compose.yml:393` references `nextcloud-network` as external  
**Reality:** Nextcloud AIO uses `nextcloud-aio` network  
**Impact:** Apps cannot reach Nextcloud containers

### 2. Admin URL Not Reachable from Nextcloud
**Current `.env`:** `ADMIN_URL=http://localhost:3000`  
**Problem:** From inside Nextcloud AIO containers, "localhost" = the container itself, NOT the host  
**Impact:** Nextcloud Social Login cannot reach admin OIDC endpoints

### 3. Hardcoded Wrong NEXTCLOUD_URL in docker-compose.yml
**Lines 156 & 295:** Still reference `http://nextcloud-nginx:80`  
**Should be:** Environment variable that resolves to Nextcloud AIO  
**Impact:** Apps can't communicate with Nextcloud

---

## Solution Overview

We need to:
1. ✅ Fix network name in docker-compose.yml
2. ✅ Update ADMIN_URL to use server IP (so Nextcloud can reach it)
3. ✅ Fix hardcoded NEXTCLOUD_URL in docker-compose.yml
4. ✅ Configure Nextcloud Social Login with correct URLs

---

## Step 1: Fix docker-compose.yml Network Configuration

### Change network reference from `nextcloud-network` to `nextcloud-aio`

**File:** `docker-compose.yml`

**Line 393 - Change:**
```yaml
networks:
  eac-network:
    driver: bridge
  nextcloud-network:  # ❌ Wrong - this doesn't exist
    external: true
```

**To:**
```yaml
networks:
  eac-network:
    driver: bridge
  nextcloud-aio:  # ✅ Correct - this is the actual network
    external: true
```

### Update all service network references

**Find and replace in entire file:**
```yaml
# Change FROM:
    networks:
      - eac-network
      - nextcloud-network

# TO:
    networks:
      - eac-network
      - nextcloud-aio
```

This affects services:
- supabase-auth (line 56-57)
- supabase-rest (line 76-78)
- supabase-realtime (line 104-106)
- admin (line 169-171)
- forum (line 194-196)
- blog-sunjay (line 228-230)
- blog-guru-dharam (line 262-264)
- inner-gathering (line 313-315)
- elkdonis-arts-collective (line 347-349)
- amrit-canada (line 381-383)

---

## Step 2: Fix Hardcoded NEXTCLOUD_URL in docker-compose.yml

### Admin app (lines 156-158)

**Change FROM:**
```yaml
      # Nextcloud (external stack via shared network)
      NEXTCLOUD_URL: http://nextcloud-nginx:80
      NEXTCLOUD_PUBLIC_URL: ${NEXTCLOUD_PUBLIC_URL:-http://localhost:8080}
      NEXT_PUBLIC_NEXTCLOUD_URL: ${NEXT_PUBLIC_NEXTCLOUD_URL:-http://localhost:8080}
```

**TO:**
```yaml
      # Nextcloud AIO
      NEXTCLOUD_URL: ${NEXTCLOUD_URL:-http://nextcloud-aio-apache:11000}
      NEXTCLOUD_PUBLIC_URL: ${NEXTCLOUD_PUBLIC_URL:-http://localhost:8080}
      NEXT_PUBLIC_NEXTCLOUD_URL: ${NEXT_PUBLIC_NEXTCLOUD_URL:-http://localhost:8080}
```

### Inner-gathering app (lines 294-297)

**Change FROM:**
```yaml
      # Nextcloud
      NEXTCLOUD_URL: http://nextcloud-nginx:80
      NEXTCLOUD_PUBLIC_URL: ${NEXTCLOUD_PUBLIC_URL:-http://localhost:8080}
      NEXT_PUBLIC_NEXTCLOUD_URL: ${NEXT_PUBLIC_NEXTCLOUD_URL:-http://localhost:8080}
```

**TO:**
```yaml
      # Nextcloud AIO
      NEXTCLOUD_URL: ${NEXTCLOUD_URL:-http://nextcloud-aio-apache:11000}
      NEXTCLOUD_PUBLIC_URL: ${NEXTCLOUD_PUBLIC_URL:-http://localhost:8080}
      NEXT_PUBLIC_NEXTCLOUD_URL: ${NEXT_PUBLIC_NEXTCLOUD_URL:-http://localhost:8080}
```

---

## Step 3: Update .env File

**Your server IP:** `192.168.0.11`

**Update the following variables:**

```bash
# Admin app URL - MUST be accessible from Nextcloud containers
# Option 1: Use server IP (works from anywhere on network)
ADMIN_URL=http://192.168.0.11:3000

# Option 2: Use host.docker.internal (special Docker DNS name for host)
# ADMIN_URL=http://host.docker.internal:3000

# Nextcloud URLs (you already have these correct!)
NEXTCLOUD_URL=http://nextcloud-aio-apache:11000
NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.elkdonis-arts.org

# For production, if you have a domain for admin:
# ADMIN_URL=https://admin.elkdonis-arts.org
```

**Why use server IP?**
- ✅ Accessible from Nextcloud AIO containers (different Docker network)
- ✅ Accessible from browser (for testing .well-known endpoints)
- ✅ Works without additional reverse proxy setup

---

## Step 4: Configure Nextcloud Social Login

### Access Nextcloud Admin Settings

1. Go to: https://cloud.elkdonis-arts.org
2. Navigate to: **Settings** → **Administration** → **Social Login**
3. Click: **Add Custom OAuth2**

### Provider Configuration

**Provider Name:** `elkdonis` *(must match exactly)*

**Client Configuration:**
```
Client ID: nextcloud
Client Secret: <value from .env NEXTCLOUD_OIDC_SECRET>
```

**Endpoint Configuration:**

Using your server IP (192.168.0.11):
```
Discovery URL: http://192.168.0.11:3000/.well-known/openid-configuration

OR manually configure:

Authorization URL: http://192.168.0.11:3000/api/oidc/authorize
Token URL: http://192.168.0.11:3000/api/oidc/token
User Info URL: http://192.168.0.11:3000/api/oidc/userinfo
```

**Scope:** `openid email profile`

**Advanced Options:**
- ✅ Enable: "Prevent create new users"
- ✅ Enable: "Update user profile on login"
- ⬜ Disable: "Disable login without OAuth"

### Test the Discovery URL

Before saving, test from your browser:
```bash
curl http://192.168.0.11:3000/.well-known/openid-configuration
```

Should return JSON with issuer, authorization_endpoint, etc.

---

## Step 5: Restart Services

```bash
cd /mnt/pool1/home/stephan/eac/eac-repo-main/eac-repo-main

# Stop all containers
docker-compose down

# Rebuild with new configuration
docker-compose up -d

# Verify services started
docker-compose ps

# Check admin app is accessible
curl http://192.168.0.11:3000/.well-known/openid-configuration

# Check admin can reach Nextcloud AIO
docker exec eac-admin curl http://nextcloud-aio-apache:11000/status.php
```

---

## Step 6: Test the OIDC Flow

### Manual Test

1. **Check OIDC Discovery:**
   ```bash
   # From browser or curl:
   http://192.168.0.11:3000/.well-known/openid-configuration
   ```

2. **Test Authorization Endpoint:**
   ```bash
   # This should redirect to login or prompt for auth:
   http://192.168.0.11:3000/api/oidc/authorize?client_id=nextcloud&redirect_uri=https://cloud.elkdonis-arts.org/apps/sociallogin/custom_oauth2/elkdonis&response_type=code&scope=openid
   ```

3. **Test from Nextcloud:**
   - Go to: https://cloud.elkdonis-arts.org/login
   - Look for "Login with elkdonis" button
   - Click it and observe the redirect chain

### Test Talk Room Flow

1. **Login to inner-gathering:**
   ```
   http://192.168.0.11:3004
   ```

2. **Find a meeting with Talk room**

3. **Click "Join Talk Room"**

4. **Expected flow:**
   ```
   inner-gathering → /api/talk/join (creates JWT cookie)
   → Nextcloud Social Login
   → http://192.168.0.11:3000/api/oidc/authorize (reads JWT)
   → back to Nextcloud with auth code
   → Nextcloud exchanges code at http://192.168.0.11:3000/api/oidc/token
   → User logged into Talk room ✅
   ```

---

## Debugging

### Check network connectivity

```bash
# Verify admin is on nextcloud-aio network
docker network inspect nextcloud-aio | grep -A 5 eac-admin

# Test from Nextcloud container to admin app
docker exec nextcloud-aio-apache curl http://192.168.0.11:3000/.well-known/openid-configuration

# Or using host.docker.internal:
docker exec nextcloud-aio-apache curl http://host.docker.internal:3000/.well-known/openid-configuration
```

### Check admin app logs

```bash
docker logs eac-admin -f --tail 50
```

Look for:
- `[oidc/authorize]` - Authorization requests
- `[token]` - Token exchange requests
- `[talk/join]` - JWT creation

### Check Nextcloud logs

In Nextcloud Admin → Settings → Logging or:
```bash
docker exec nextcloud-aio-nextcloud tail -f /var/www/html/data/nextcloud.log
```

Look for Social Login errors.

---

## Alternative: Setup Reverse Proxy (Advanced)

If you don't want to expose port 3000, setup nginx reverse proxy in Nextcloud AIO:

### 1. Create nginx config in Nextcloud

Map `https://cloud.elkdonis-arts.org/admin/` → `http://192.168.0.11:3000/`

### 2. Update ADMIN_URL

```bash
ADMIN_URL=https://cloud.elkdonis-arts.org/admin
```

### 3. Configure Social Login to use proxy URL

```
Discovery URL: https://cloud.elkdonis-arts.org/admin/.well-known/openid-configuration
```

This keeps everything behind your main domain.

---

## Security Considerations

### Using Server IP (192.168.0.11:3000)

**Pros:**
- ✅ Simple, works immediately
- ✅ Good for local network testing

**Cons:**
- ⚠️ Port 3000 is exposed on your local network
- ⚠️ No HTTPS (but OK for internal network)

**Mitigation:**
- Firewall port 3000 to only allow:
  - Your local subnet (192.168.0.0/24)
  - Specifically the Nextcloud server IP

### Production Setup

For production, use one of:
1. **Domain with HTTPS:** `ADMIN_URL=https://admin.elkdonis-arts.org`
2. **Reverse Proxy:** Route through Nextcloud's nginx
3. **VPN:** If apps are on separate machines

---

## Summary of Changes

### Files to modify:
1. ✅ **docker-compose.yml** - Fix network name and NEXTCLOUD_URL
2. ✅ **.env** - Update ADMIN_URL to server IP
3. ✅ **Nextcloud Social Login settings** - Use server IP

### Commands to run:
```bash
# 1. Edit docker-compose.yml (network name + NEXTCLOUD_URL)
# 2. Edit .env (ADMIN_URL)
# 3. Restart containers
docker-compose down && docker-compose up -d

# 4. Configure Nextcloud Social Login
# 5. Test OIDC flow
```

---

## Expected Result

✅ Nextcloud AIO can reach admin app at `http://192.168.0.11:3000`  
✅ OIDC authentication flow works  
✅ Users can click "Join Talk Room" and seamlessly login to Nextcloud Talk  
✅ No re-authentication required when already logged into inner-gathering
