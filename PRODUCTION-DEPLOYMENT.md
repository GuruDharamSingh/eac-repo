# Production Deployment Guide

## Overview

This guide covers deploying EAC apps to a server with **existing Nextcloud infrastructure**, maintaining tight coupling between your apps and Nextcloud services.

## Prerequisites

- Server with Docker and Docker Compose installed
- Existing Nextcloud installation (from your friend)
- Access to Nextcloud's Docker network
- Domain name configured (optional but recommended)

## Architecture

```
Production Server
├── Nextcloud Stack (Pre-existing)
│   ├── nextcloud-app
│   ├── nextcloud-postgres
│   ├── nextcloud-redis
│   └── nextcloud-nginx
│   └─ Network: nextcloud-network (external)
│
└── EAC Stack (New)
    ├── inner-gathering
    ├── postgres (EAC's own database)
    ├── redis
    ├── supabase-auth
    └── Network: eac-network (internal)
         └─ Bridge: nextcloud-network (for Nextcloud API access)
```

## Step 1: Discover Existing Nextcloud Network

On the production server, identify the Nextcloud Docker network:

```bash
# Find Nextcloud containers
docker ps | grep nextcloud

# List networks and find the one Nextcloud uses
docker network ls

# Inspect Nextcloud container to see its network
docker inspect <nextcloud-container-name> | grep NetworkMode
```

Example output: `nextcloud_default` or `nextcloud-network`

## Step 2: Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL - EAC's own database
  postgres:
    image: postgres:16-alpine
    container_name: eac-postgres-prod
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - eac-network

  # Redis Cache
  redis:
    image: redis:alpine
    container_name: eac-redis-prod
    restart: unless-stopped
    volumes:
      - redis_data_prod:/data
    networks:
      - eac-network

  # Supabase Auth
  supabase-auth:
    image: supabase/gotrue:v2.151.0
    container_name: eac-supabase-auth-prod
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${SUPABASE_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?search_path=auth
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS}
      GOTRUE_DISABLE_SIGNUP: ${DISABLE_SIGNUP:-false}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: ${JWT_EXPIRY:-3600}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: ${ENABLE_EMAIL_SIGNUP:-true}
      GOTRUE_MAILER_AUTOCONFIRM: ${MAILER_AUTOCONFIRM:-false}
      GOTRUE_SMTP_HOST: ${SMTP_HOST}
      GOTRUE_SMTP_PORT: ${SMTP_PORT}
      GOTRUE_SMTP_USER: ${SMTP_USER}
      GOTRUE_SMTP_PASS: ${SMTP_PASS}
      GOTRUE_SMTP_ADMIN_EMAIL: ${SMTP_ADMIN_EMAIL}
    ports:
      - "9999:9999"
    restart: unless-stopped
    networks:
      - eac-network
      - nextcloud-network  # Bridge to Nextcloud

  # Supabase PostgREST
  supabase-rest:
    image: postgrest/postgrest:v12.0.2
    container_name: eac-supabase-rest-prod
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
    ports:
      - "9998:3000"
    restart: unless-stopped
    networks:
      - eac-network
      - nextcloud-network  # For media proxy

  # Supabase Realtime
  supabase-realtime:
    image: supabase/realtime:v2.29.15
    container_name: eac-supabase-realtime-prod
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      APP_NAME: realtime
      PORT: 4000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${POSTGRES_DB}
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_SSL: "false"
      SECRET_KEY_BASE: ${REALTIME_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "4000:4000"
    restart: unless-stopped
    networks:
      - eac-network

  # Inner Gathering App (Production Build)
  inner-gathering:
    build:
      context: .
      dockerfile: Dockerfile.prod
      target: production
    container_name: eac-inner-gathering-prod
    depends_on:
      postgres:
        condition: service_healthy
      supabase-auth:
        condition: service_started
    environment:
      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

      # Supabase Auth (Internal)
      SUPABASE_URL: http://supabase-auth:9999
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}  # Public facing URL
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}

      # Redis
      REDIS_URL: redis://redis:6379

      # Nextcloud (Internal Docker network)
      NEXTCLOUD_URL: ${NEXTCLOUD_INTERNAL_URL}  # e.g. http://nextcloud-app:9000
      NEXTCLOUD_ADMIN_USER: ${NEXTCLOUD_ADMIN_USER}
      NEXTCLOUD_ADMIN_PASSWORD: ${NEXTCLOUD_ADMIN_PASSWORD}
      NEXT_PUBLIC_NEXTCLOUD_URL: ${NEXT_PUBLIC_NEXTCLOUD_URL}  # Public URL

      # Production
      NODE_ENV: production
      PORT: 3004
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      NODE_OPTIONS: "--max-old-space-size=512"
    volumes:
      - ./apps/inner-gathering/.next:/app/apps/inner-gathering/.next:ro
    ports:
      - "3004:3004"
    restart: unless-stopped
    mem_limit: 768m
    memswap_limit: 768m
    networks:
      - eac-network
      - nextcloud-network  # Bridge to access Nextcloud APIs

volumes:
  postgres_data_prod:
  redis_data_prod:

networks:
  eac-network:
    driver: bridge
  nextcloud-network:
    external: true
    name: ${NEXTCLOUD_NETWORK_NAME}  # Set in .env.production
```

## Step 3: Create Production Dockerfile

Create `Dockerfile.prod`:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages ./packages
COPY apps/inner-gathering/package.json ./apps/inner-gathering/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/inner-gathering/node_modules ./apps/inner-gathering/node_modules

# Copy source
COPY . .

# Build shared packages
RUN pnpm --filter @elkdonis/db build
RUN pnpm --filter @elkdonis/ui build
RUN pnpm --filter @elkdonis/nextcloud build
RUN pnpm --filter @elkdonis/auth-client build
RUN pnpm --filter @elkdonis/auth-server build
RUN pnpm --filter @elkdonis/services build
RUN pnpm --filter @elkdonis/types build
RUN pnpm --filter @elkdonis/utils build
RUN pnpm --filter @elkdonis/hooks build

# Build inner-gathering app
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN cd apps/inner-gathering && pnpm build

# Stage 3: Production Runtime
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Add non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/inner-gathering/.next ./apps/inner-gathering/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/inner-gathering/public ./apps/inner-gathering/public
COPY --from=builder /app/apps/inner-gathering/package.json ./apps/inner-gathering/
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

USER nextjs

EXPOSE 3004

ENV PORT 3004
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

CMD ["sh", "-c", "cd apps/inner-gathering && pnpm docker:start"]
```

## Step 4: Create Production Environment File

Create `.env.production`:

```env
# PostgreSQL
POSTGRES_USER=eac_prod
POSTGRES_PASSWORD=<strong-password-here>
POSTGRES_DB=elkdonis_prod

# JWT & Auth
JWT_SECRET=<generate-with: openssl rand -base64 64>
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>
JWT_EXPIRY=3600

# Supabase Auth URLs
SUPABASE_URL=https://yourdomain.com/auth
NEXT_PUBLIC_SUPABASE_URL=https://yourdomain.com/auth

# Realtime
REALTIME_SECRET=<generate-with: openssl rand -base64 64>

# Site Configuration
SITE_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ADDITIONAL_REDIRECT_URLS=https://yourdomain.com,https://www.yourdomain.com

# Email (for user invites)
DISABLE_SIGNUP=true  # Require admin invitation
ENABLE_EMAIL_SIGNUP=true
MAILER_AUTOCONFIRM=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=<smtp-password>
SMTP_ADMIN_EMAIL=admin@yourdomain.com

# Nextcloud (Friend's Existing Instance)
NEXTCLOUD_NETWORK_NAME=nextcloud_default  # From Step 1
NEXTCLOUD_INTERNAL_URL=http://nextcloud-app:9000  # Internal Docker name
NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.friendsdomain.com  # Public URL
NEXTCLOUD_ADMIN_USER=eac_integration  # Create dedicated user
NEXTCLOUD_ADMIN_PASSWORD=<app-password-from-nextcloud>
```

## Step 5: Pre-Deployment Checklist

### On Development Machine

1. **Test production build locally**:
   ```bash
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d

   # Check memory usage
   docker stats eac-inner-gathering-prod --no-stream
   # Should be ~300-500MB vs 1.5GB in dev

   # Test the app
   curl http://localhost:3004

   # Cleanup
   docker compose -f docker-compose.prod.yml down
   ```

2. **Create production secrets**:
   ```bash
   # Generate secure secrets
   openssl rand -base64 64  # For JWT_SECRET
   openssl rand -base64 64  # For REALTIME_SECRET
   ```

3. **Prepare deployment package**:
   ```bash
   # Create tarball
   tar czf eac-deployment.tar.gz \
     docker-compose.prod.yml \
     Dockerfile.prod \
     .env.production \
     apps/ \
     packages/ \
     package.json \
     pnpm-lock.yaml \
     pnpm-workspace.yaml
   ```

### On Production Server (Friend's)

4. **Create Nextcloud integration user**:
   - Login to Nextcloud as admin
   - Create new user: `eac_integration`
   - Grant necessary permissions
   - Generate app password: Settings → Security → Devices & Sessions
   - Add app password to `.env.production`

5. **Verify Nextcloud network**:
   ```bash
   docker network inspect nextcloud_default
   # Confirm nextcloud containers are on this network
   ```

## Step 6: Deployment

### Transfer Files

```bash
# From dev machine
scp eac-deployment.tar.gz user@friend-server:/opt/eac/

# On production server
cd /opt/eac
tar xzf eac-deployment.tar.gz
```

### Run Database Migrations

```bash
# On production server
cd /opt/eac

# Start only postgres first
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for postgres to be healthy
docker compose -f docker-compose.prod.yml logs postgres

# Run migrations
docker compose -f docker-compose.prod.yml run --rm inner-gathering \
  sh -c "cd packages/db && pnpm db:migrate"
```

### Start Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Verify services are running
docker compose -f docker-compose.prod.yml ps
```

### Test Nextcloud Integration

```bash
# Test from inner-gathering container
docker compose -f docker-compose.prod.yml exec inner-gathering \
  curl -u eac_integration:$NEXTCLOUD_ADMIN_PASSWORD \
  http://nextcloud-app:9000/ocs/v2.php/cloud/users/eac_integration

# Should return user info XML/JSON
```

## Step 7: Reverse Proxy Setup (Nginx/Caddy)

### Option A: Nginx

```nginx
# /etc/nginx/sites-available/eac
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B: Caddy

```caddyfile
# /etc/caddy/Caddyfile
yourdomain.com {
    reverse_proxy localhost:3004

    handle /auth/* {
        reverse_proxy localhost:9999
    }
}
```

## Step 8: Post-Deployment

### Verify Everything Works

```bash
# Check all containers are healthy
docker compose -f docker-compose.prod.yml ps

# Check memory usage
docker stats --no-stream

# Test endpoints
curl https://yourdomain.com
curl https://yourdomain.com/api/health  # If you have health check

# Check Nextcloud integration
# Create a test meeting and verify it syncs to Nextcloud Calendar
```

### Setup Monitoring

```bash
# Add to crontab for basic monitoring
*/5 * * * * /opt/eac/health-check.sh
```

Create `/opt/eac/health-check.sh`:
```bash
#!/bin/bash
if ! docker compose -f /opt/eac/docker-compose.prod.yml ps | grep -q Up; then
    echo "EAC services down!" | mail -s "EAC Alert" admin@yourdomain.com
    docker compose -f /opt/eac/docker-compose.prod.yml up -d
fi
```

### Backup Strategy

```bash
# Backup script
#!/bin/bash
BACKUP_DIR=/backup/eac/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# Backup database
docker compose -f /opt/eac/docker-compose.prod.yml exec postgres \
  pg_dump -U eac_prod elkdonis_prod > $BACKUP_DIR/database.sql

# Backup environment
cp /opt/eac/.env.production $BACKUP_DIR/

# Keep 30 days
find /backup/eac -type d -mtime +30 -exec rm -rf {} +
```

## Maintenance

### Updating the Application

```bash
# On dev machine: build and test
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Transfer new build
scp eac-deployment.tar.gz user@friend-server:/opt/eac/

# On production: deploy update
cd /opt/eac
tar xzf eac-deployment.tar.gz
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec inner-gathering \
  sh -c "cd packages/db && pnpm db:migrate"
```

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f inner-gathering

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 inner-gathering
```

## Troubleshooting

### Inner-gathering can't connect to Nextcloud

```bash
# Verify network connectivity
docker compose -f docker-compose.prod.yml exec inner-gathering \
  ping nextcloud-app

# Check Nextcloud is on the expected network
docker network inspect nextcloud_default

# Verify environment variables
docker compose -f docker-compose.prod.yml exec inner-gathering env | grep NEXTCLOUD
```

### Database connection issues

```bash
# Check postgres is running
docker compose -f docker-compose.prod.yml ps postgres

# Test connection
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U eac_prod -d elkdonis_prod -c "SELECT NOW();"
```

### Memory issues

```bash
# Check current usage
docker stats --no-stream

# Increase limit if needed (edit docker-compose.prod.yml)
mem_limit: 1g  # Increase from 768m

# Restart
docker compose -f docker-compose.prod.yml restart inner-gathering
```

## Security Considerations

1. **Firewall**: Only expose necessary ports (80, 443)
2. **SSL/TLS**: Use Let's Encrypt certificates
3. **Secrets**: Never commit `.env.production` to git
4. **Network**: Use `external: true` for Nextcloud network to prevent accidental modifications
5. **User**: Run as non-root user (handled in Dockerfile)
6. **Updates**: Regularly update Docker images

## Expected Performance

- **Memory**: 300-500MB per service
- **CPU**: <10% idle, <50% under load
- **Response Time**: <200ms average
- **Cold Start**: ~2-3 seconds
- **Hot Reload**: N/A (production doesn't have HMR)

## Summary

✅ Two-network design is correct for your use case
✅ Production memory: 300-500MB (vs 1.5GB dev)
✅ Tight coupling with friend's Nextcloud maintained
✅ Easy to deploy and update
✅ Isolated but integrated with existing infrastructure
