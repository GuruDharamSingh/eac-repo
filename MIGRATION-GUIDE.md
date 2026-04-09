# Migration Guide: Moving EAC to New Server with Different Nextcloud

This guide explains how to migrate the EAC (Elkdonis Arts Collective) repository to a new server and connect it to a different Nextcloud instance.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What Needs to Change](#what-needs-to-change)
4. [Migration Methods](#migration-methods)
5. [Step-by-Step Migration](#step-by-step-migration)
6. [Post-Migration Checklist](#post-migration-checklist)
7. [Rollback Plan](#rollback-plan)

---

## Overview

### Current Setup
- **Location**: Development machine (192.168.0.24)
- **Nextcloud**: Local instance at http://192.168.0.24:8080
- **Database**: PostgreSQL in Docker (dev data)
- **Environment**: Development mode with hot reload

### Target Setup
- **Location**: Production server (new IP/domain)
- **Nextcloud**: Existing Nextcloud instance (different server)
- **Database**: Fresh PostgreSQL (production)
- **Environment**: Production mode (optimized builds)

---

## Prerequisites

### On New Server
- [ ] Docker and Docker Compose installed
- [ ] Access to existing Nextcloud instance
- [ ] Domain name configured (optional but recommended)
- [ ] SSL certificates (Let's Encrypt recommended)
- [ ] Minimum 2GB RAM, 20GB disk space
- [ ] Port access: 80, 443, 3004, 9999, 5432

### On Development Machine
- [ ] Git repository up to date
- [ ] All changes committed
- [ ] Production secrets generated
- [ ] Deployment package prepared

### Nextcloud Requirements
- [ ] Admin access to Nextcloud
- [ ] Ability to create new users
- [ ] Ability to generate app passwords
- [ ] Access to Nextcloud's Docker network (if Nextcloud is containerized)

---

## What Needs to Change

### 1. Environment Variables (.env.production)

| Variable | Current Value | New Value | Purpose |
|----------|--------------|-----------|---------|
| `SERVER_HOST` | localhost or 192.168.0.24 | new-server.com | Public hostname |
| `NEXTCLOUD_URL` | http://nextcloud-nginx:80 | http://nextcloud-container:PORT | Internal Nextcloud URL |
| `NEXT_PUBLIC_NEXTCLOUD_URL` | http://192.168.0.24:8080 | https://cloud.newserver.com | Public Nextcloud URL |
| `NEXTCLOUD_ADMIN_USER` | admin | eac_integration | Dedicated integration user |
| `NEXTCLOUD_ADMIN_PASSWORD` | current-password | app-password-from-nextcloud | App password (not user password) |
| `DATABASE_URL` | postgres://postgres:...@localhost | postgres://eac_prod:...@postgres | Production DB credentials |
| `JWT_SECRET` | dev-secret | openssl rand -base64 64 | Secure production secret |
| `SITE_URL` | http://localhost:3000 | https://app.newserver.com | Public app URL |

### 2. Docker Network Configuration

**Current**: Single Docker network
**New**: Bridge between EAC network and Nextcloud network

```yaml
# docker-compose.prod.yml
networks:
  eac-network:
    driver: bridge
  nextcloud-network:
    external: true  # Connect to existing Nextcloud
    name: ${NEXTCLOUD_NETWORK_NAME}  # e.g., nextcloud_default
```

### 3. Database

**Current**: Development data
**New**: Fresh database with migrations

- No data migration needed (starting fresh)
- Run migrations on new server
- Test user creation required

### 4. Build Mode

**Current**: Development (hot reload, source maps)
**New**: Production (optimized, minified, no dev tools)

- Memory: 1.5GB → 300-500MB
- Startup: Uses volume mounts → Uses built artifacts
- Build time: ~2-3 minutes

---

## Migration Methods

### Method 1: Git Clone (Recommended)

**Best for**: Clean deployment, version control

```bash
# On new server
cd /opt
git clone https://github.com/your-org/eac-repo.git
cd eac-repo
git checkout main  # or production branch

# Copy production environment
cp .env.production.example .env.production
# Edit .env.production with new server values
nano .env.production
```

**Pros**:
- Clean installation
- Easy to update (git pull)
- Version tracked
- Smaller transfer size

**Cons**:
- Requires Git access
- Need to rebuild on server

---

### Method 2: Tarball Transfer

**Best for**: No Git access, quick deployment

```bash
# On development machine
tar czf eac-deployment.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=dist \
  docker-compose.prod.yml \
  Dockerfile.prod \
  .env.production.example \
  apps/ \
  packages/ \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml

# Transfer to new server
scp eac-deployment.tar.gz user@newserver:/opt/

# On new server
cd /opt
tar xzf eac-deployment.tar.gz
mv eac-deployment eac-repo  # or your preferred name
cd eac-repo
```

**Pros**:
- No Git required
- Exact copy of dev
- Offline deployment

**Cons**:
- Large file size
- Harder to update
- Manual version control

---

### Method 3: Docker Registry (Advanced)

**Best for**: Automated deployments, CI/CD

```bash
# On development machine
docker compose -f docker-compose.prod.yml build
docker tag eac-inner-gathering:latest your-registry.com/eac:latest
docker push your-registry.com/eac:latest

# On new server
docker pull your-registry.com/eac:latest
docker compose -f docker-compose.prod.yml up -d
```

**Pros**:
- Fast deployment
- Automated updates
- Consistent builds

**Cons**:
- Requires Docker registry
- More complex setup

---

## Step-by-Step Migration

### Phase 1: Prepare Development Machine

#### 1.1 Generate Production Secrets

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
REALTIME_SECRET=$(openssl rand -base64 64)
INTER_APP_SECRET=$(openssl rand -base64 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "REALTIME_SECRET=$REALTIME_SECRET"
echo "INTER_APP_SECRET=$INTER_APP_SECRET"

# Save these securely!
```

#### 1.2 Create Production Environment File

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with new server values:

```env
# ==================================================================
# Production Configuration for [NEW SERVER NAME]
# ==================================================================

# Server / Network
SERVER_HOST=app.newserver.com
SITE_URL=https://app.newserver.com
NEXT_PUBLIC_APP_URL=https://app.newserver.com
ADDITIONAL_REDIRECT_URLS=https://app.newserver.com,https://www.app.newserver.com

# Database (PostgreSQL) - NEW CREDENTIALS
POSTGRES_USER=eac_prod
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_DB=elkdonis_prod
DATABASE_URL=postgresql://eac_prod:<password>@postgres:5432/elkdonis_prod

# Redis
REDIS_URL=redis://redis:6379

# JWT & Auth - USE GENERATED SECRETS
JWT_SECRET=<paste-jwt-secret-from-above>
SUPABASE_ANON_KEY=<generate-or-reuse>
SUPABASE_SERVICE_KEY=<generate-or-reuse>
JWT_EXPIRY=3600
REALTIME_SECRET=<paste-realtime-secret-from-above>
INTER_APP_JWT_SECRET=<paste-inter-app-secret-from-above>

# Supabase Auth URLs
SUPABASE_URL=http://supabase-auth:9999
NEXT_PUBLIC_SUPABASE_URL=https://app.newserver.com/auth

# Auth Settings
DISABLE_SIGNUP=true  # Require admin invitation
ENABLE_EMAIL_SIGNUP=true
MAILER_AUTOCONFIRM=false

# Email / SMTP - CONFIGURE FOR NEW SERVER
SMTP_HOST=smtp.newserver.com
SMTP_PORT=587
SMTP_USER=noreply@newserver.com
SMTP_PASS=<smtp-password>
SMTP_ADMIN_EMAIL=admin@newserver.com
EMAIL_CLIENT=smtp

# Nextcloud - CRITICAL: UPDATE FOR NEW INSTANCE
NEXTCLOUD_NETWORK_NAME=nextcloud_default  # Discover on new server
NEXTCLOUD_URL=http://nextcloud-app:9000  # Internal Docker name
NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.newserver.com  # Public URL
NEXTCLOUD_PUBLIC_URL=https://cloud.newserver.com
NEXTCLOUD_ADMIN_USER=eac_integration  # Create this user
NEXTCLOUD_ADMIN_PASSWORD=<app-password-from-nextcloud>  # App password, NOT user password
NEXTCLOUD_OIDC_SECRET=<generate-random-secret>
NEXTCLOUD_WEBHOOK_SECRET=<generate-random-secret>

# Production Settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

#### 1.3 Test Production Build Locally (Optional but Recommended)

```bash
# Build production image
docker compose -f docker-compose.prod.yml build

# Test run (won't connect to Nextcloud yet)
docker compose -f docker-compose.prod.yml up -d postgres redis

# Check build size and memory
docker images | grep eac
docker stats --no-stream
```

#### 1.4 Commit and Tag Release

```bash
git add .
git commit -m "feat: add live video feed with privacy control"
git tag -a v1.0.0 -m "Release v1.0.0 - Live video feed"
git push origin main --tags
```

---

### Phase 2: Discover New Server Environment

#### 2.1 Discover Nextcloud Docker Network

```bash
# SSH into new server
ssh user@newserver

# Find Nextcloud containers
docker ps | grep nextcloud

# Example output:
# abc123  nextcloud:latest  ...  nextcloud-app
# def456  nginx:alpine      ...  nextcloud-nginx
# ghi789  postgres:16       ...  nextcloud-postgres

# List Docker networks
docker network ls

# Example output:
# NETWORK ID     NAME                 DRIVER    SCOPE
# 123abc         nextcloud_default    bridge    local
# 456def         bridge               bridge    local

# Inspect Nextcloud network
docker network inspect nextcloud_default

# Look for containers attached to this network
# Note the network name (e.g., nextcloud_default)
```

#### 2.2 Identify Nextcloud Container Names

```bash
# Get Nextcloud app container name
docker ps --filter "name=nextcloud" --format "{{.Names}}"

# Example output:
# nextcloud-app
# nextcloud-nginx
# nextcloud-postgres

# Note: Use "nextcloud-app" for NEXTCLOUD_URL
```

#### 2.3 Test Nextcloud API Access

```bash
# Test OCS API (replace with actual container name)
docker exec nextcloud-app curl -u admin:password \
  http://localhost:9000/ocs/v2.php/cloud/capabilities

# Should return XML/JSON with Nextcloud version
```

---

### Phase 3: Prepare Nextcloud Integration

#### 3.1 Create Integration User

1. Login to Nextcloud web interface as admin
2. Navigate to **Users** → **Create new user**
3. Create user:
   - Username: `eac_integration`
   - Password: (strong random password)
   - Groups: (optional, create "EAC Apps" group)

#### 3.2 Generate App Password

1. Login as `eac_integration` user
2. Navigate to **Settings** → **Security**
3. Under **Devices & sessions**, create new app password:
   - Name: "Inner Gathering Integration"
   - Click **Create new app password**
4. **Copy the generated password** (you won't see it again!)
5. This is your `NEXTCLOUD_ADMIN_PASSWORD` in `.env.production`

#### 3.3 Grant Permissions (If Required)

```bash
# If using Nextcloud Talk, enable for integration user
# As admin, navigate to Talk settings and grant permissions

# If using Calendar, create a calendar for integration user
# Settings → Groupware → Calendar → Create calendar
```

---

### Phase 4: Transfer Files to New Server

#### Option A: Git Clone

```bash
# On new server
cd /opt
sudo git clone https://github.com/your-org/eac-repo.git
sudo chown -R $USER:$USER eac-repo
cd eac-repo

# Copy production environment
cp .env.production.example .env.production
```

Transfer `.env.production` from dev machine:
```bash
# On dev machine
scp .env.production user@newserver:/opt/eac-repo/
```

#### Option B: Tarball

```bash
# On dev machine
tar czf eac-deployment.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=dist \
  --exclude=*.log \
  .

# Transfer
scp eac-deployment.tar.gz user@newserver:/opt/

# On new server
cd /opt
tar xzf eac-deployment.tar.gz
mv eac-deployment eac-repo
```

---

### Phase 5: Deploy on New Server

#### 5.1 Update .env.production

```bash
cd /opt/eac-repo
nano .env.production
```

Update these critical values:
- `NEXTCLOUD_NETWORK_NAME` → (from Phase 2.1)
- `NEXTCLOUD_URL` → (from Phase 2.2)
- `NEXTCLOUD_ADMIN_PASSWORD` → (from Phase 3.2)
- All other new server URLs

#### 5.2 Build and Start Services

```bash
# Install dependencies (if using Git method)
pnpm install

# Build shared packages
pnpm --filter @elkdonis/db build
pnpm --filter @elkdonis/ui build
pnpm --filter @elkdonis/nextcloud build
pnpm --filter @elkdonis/auth-client build
pnpm --filter @elkdonis/auth-server build

# Start infrastructure services first
docker compose -f docker-compose.prod.yml up -d postgres redis supabase-auth

# Wait for postgres to be healthy
docker compose -f docker-compose.prod.yml logs -f postgres
# Wait for: "database system is ready to accept connections"
```

#### 5.3 Run Database Migrations

```bash
# Run migrations
docker compose -f docker-compose.prod.yml run --rm inner-gathering \
  sh -c "cd /app/packages/db && pnpm db:migrate"

# Expected output:
# 🚀 Starting database setup...
# 🔨 Setting up database...
# 📋 Creating tables...
# ✅ Tables created
# ✅ Database setup complete
```

#### 5.4 Start Application Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# All services should show "Up"
```

---

### Phase 6: Verify Integration

#### 6.1 Test Nextcloud Connectivity

```bash
# From inner-gathering container
docker compose -f docker-compose.prod.yml exec inner-gathering \
  ping nextcloud-app

# Should get ping responses
```

#### 6.2 Test Nextcloud API

```bash
# Test user API
docker compose -f docker-compose.prod.yml exec inner-gathering \
  curl -u eac_integration:$NEXTCLOUD_ADMIN_PASSWORD \
  http://nextcloud-app:9000/ocs/v2.php/cloud/users/eac_integration

# Should return user info
```

#### 6.3 Test Application

```bash
# Test health endpoint
curl http://localhost:3004

# Should return HTML or API response
```

---

### Phase 7: Configure Reverse Proxy

#### Option A: Nginx

```nginx
# /etc/nginx/sites-available/eac
server {
    listen 80;
    server_name app.newserver.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.newserver.com;

    ssl_certificate /etc/letsencrypt/live/app.newserver.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.newserver.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Inner Gathering App
    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Supabase Auth
    location /auth/ {
        proxy_pass http://localhost:9999/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/eac /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Caddy

```caddyfile
# /etc/caddy/Caddyfile
app.newserver.com {
    reverse_proxy localhost:3004

    handle /auth/* {
        reverse_proxy localhost:9999
    }

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }
}
```

```bash
sudo systemctl reload caddy
```

---

### Phase 8: Setup SSL

#### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (Nginx)
sudo certbot --nginx -d app.newserver.com

# Or for Caddy (automatic)
# Caddy handles SSL automatically
```

---

## Post-Migration Checklist

### Functionality Tests

- [ ] Application loads at https://app.newserver.com
- [ ] User can sign up / login
- [ ] User can create a meeting
- [ ] Meeting syncs to Nextcloud Calendar
- [ ] Talk room is created when enabled
- [ ] File upload to Nextcloud works
- [ ] Live video feed displays countdown
- [ ] Live video feed shows active meetings (when enabled)
- [ ] Realtime features work (notifications, presence)

### Security Checks

- [ ] HTTPS enabled with valid certificate
- [ ] HTTP redirects to HTTPS
- [ ] Firewall configured (only 80, 443 open)
- [ ] `.env.production` not committed to git
- [ ] Strong database password set
- [ ] JWT secrets are random and secure
- [ ] Nextcloud app password used (not user password)
- [ ] SMTP credentials secured

### Performance Checks

- [ ] Memory usage < 1GB per container
- [ ] Page load time < 2 seconds
- [ ] Database queries optimized
- [ ] Images/assets loading properly

### Monitoring Setup

- [ ] Docker containers auto-restart (`restart: unless-stopped`)
- [ ] Log rotation configured
- [ ] Backup script created
- [ ] Health check endpoint working
- [ ] Monitoring/alerting configured

---

## Rollback Plan

If something goes wrong, you can roll back:

### Quick Rollback (Keep Running)

```bash
# On new server - stop services
docker compose -f docker-compose.prod.yml down

# Dev machine stays running
# No data loss
```

### Full Rollback

```bash
# On new server
docker compose -f docker-compose.prod.yml down -v  # Remove volumes

# On dev machine - continue using as before
# Point DNS back to dev machine if needed
```

### Database Backup Before Migration

```bash
# Before starting migration, backup dev database
docker compose exec postgres pg_dump -U postgres -d elkdonis_dev > backup.sql

# Restore if needed
docker compose exec postgres psql -U postgres -d elkdonis_dev < backup.sql
```

---

## Troubleshooting

### Can't connect to Nextcloud

```bash
# Check network
docker network inspect nextcloud_default

# Verify container name
docker ps | grep nextcloud

# Test from inside container
docker compose exec inner-gathering ping nextcloud-app
```

### Database connection errors

```bash
# Check credentials match
docker compose exec inner-gathering env | grep DATABASE

# Test connection
docker compose exec postgres psql -U eac_prod -d elkdonis_prod
```

### "LIVE" page shows error

```bash
# Check logs
docker compose logs inner-gathering | grep -i error

# Verify API endpoint
curl http://localhost:3004/api/live/current

# Check database has meetings
docker compose exec postgres psql -U eac_prod -d elkdonis_prod \
  -c "SELECT id, title, show_in_live_feed FROM meetings WHERE show_in_live_feed = true;"
```

### Memory issues

```bash
# Check usage
docker stats --no-stream

# Increase if needed (edit docker-compose.prod.yml)
mem_limit: 1g  # from 768m
```

---

## Summary

✅ **Two migration methods**: Git clone (recommended) or tarball transfer
✅ **Environment-specific configuration**: All URLs and secrets updated
✅ **Nextcloud integration**: Dedicated user with app password
✅ **Network bridging**: EAC network connects to existing Nextcloud network
✅ **Production optimized**: 300-500MB memory vs 1.5GB dev
✅ **Secure by default**: SSL, strong secrets, isolated network
✅ **Rollback safe**: Can revert without data loss

**Estimated Migration Time**: 2-3 hours (including testing)

---

## Next Steps After Migration

1. Create first admin user via Supabase Auth
2. Test creating a meeting with "Show in Live Feed" enabled
3. Verify Nextcloud integration works
4. Setup regular backups
5. Configure monitoring/alerting
6. Document server-specific configuration
7. Train users on new public URL
8. Update DNS records (if applicable)
