# Production Setup (Local Machine)

## Overview

This guide sets up a **production build** on your current machine (192.168.0.24) for testing before deploying elsewhere.

**Key Points:**
- ✅ Fresh database (no data migration)
- ✅ Production-optimized build (~300-500MB memory vs 1.5GB dev)
- ✅ Uses existing Nextcloud instance
- ✅ Runs on different ports to avoid conflicts with dev
- ✅ Secure secrets generated

## Quick Start

### 1. Build Production Environment

```bash
./scripts/build-production.sh
```

This will:
- Build all shared packages
- Create optimized Docker images
- Take ~3-5 minutes

### 2. Start Services

```bash
./scripts/start-production.sh
```

Services will run on:
- **Inner Gathering**: http://192.168.0.24:3014 (instead of 3004)
- **Supabase Auth**: http://192.168.0.24:9997 (instead of 9999)
- **PostgreSQL**: localhost:5433 (instead of 5432)
- **Redis**: localhost:6380 (instead of 6379)

### 3. Run Migrations (Fresh Database)

```bash
./scripts/migrate-production.sh
```

This creates:
- Database tables
- Indexes
- Organizations (inner_group)
- **No data** - fresh start!

### 4. Test

```bash
# Check status
./scripts/status-production.sh

# Test app
curl http://192.168.0.24:3014

# Test API
curl http://192.168.0.24:3014/api/live/current
```

### 5. Stop When Done

```bash
./scripts/stop-production.sh
```

---

## What's Different from Dev?

| Aspect | Development | Production |
|--------|-------------|------------|
| **Port** | 3004 | 3014 |
| **Database** | elkdonis_dev (port 5432) | elkdonis_production (port 5433) |
| **Data** | Test data | Fresh/empty |
| **Memory** | ~1.5GB | ~300-500MB |
| **Build** | Hot reload, source maps | Optimized, minified |
| **Secrets** | Dev secrets | Strong production secrets |
| **Docker Network** | eac-network | eac-network-prod |

---

## Configuration Files

### .env.production
- **Location**: `/home/elkdonis/dev-enviroment/eac-repo/.env.production`
- **Status**: ✅ Created with strong secrets
- **Git**: ❌ **Never committed** (in .gitignore)

### docker-compose.prod.yml
- **Purpose**: Production container orchestration
- **Network**: Connects to existing Nextcloud
- **Ports**: Different from dev to avoid conflicts

### Dockerfile
- **Location**: `apps/inner-gathering/Dockerfile`
- **Type**: Multi-stage build (deps → builder → production)
- **Output**: Standalone Next.js server

---

## Testing Production Features

### 1. Create Test User

Visit: http://192.168.0.24:3014

Sign up with email (auto-confirmed in local production)

### 2. Create Meeting with Live Feed

1. Login to app
2. Create new meeting
3. ✅ Enable "Create video chat room (Nextcloud Talk)"
4. ✅ Enable "Show in Live Feed"
5. Set time to current time + 2 minutes

### 3. Test Live Feed

Visit: http://192.168.0.24:3014/live

Should show:
- Countdown timer (if meeting is upcoming)
- Live video player (if meeting is active)

### 4. Verify Nextcloud Integration

- Meeting should sync to Nextcloud Calendar
- Talk room should be created
- File uploads should work

---

## Memory Comparison

```bash
# Check production memory
docker stats --no-stream

# Expected:
# inner-gathering-prod: 300-500MB
# postgres-prod:        50-100MB
# redis-prod:           10-20MB
# supabase-auth-prod:   30-50MB
```

Compare to dev (~1.5GB for inner-gathering alone)

---

## Troubleshooting

### Build fails

```bash
# Clean and rebuild
docker compose -f docker-compose.prod.yml down
docker system prune -f
./scripts/build-production.sh
```

### Can't connect to Nextcloud

```bash
# Check Nextcloud is running
docker ps | grep nextcloud

# Check network
docker network ls | grep nextcloud

# Test from inside container
docker compose -f docker-compose.prod.yml exec inner-gathering-prod \
  ping nextcloud-nginx
```

### Database errors

```bash
# Check postgres is running
docker compose -f docker-compose.prod.yml ps postgres-prod

# Connect to database
docker compose -f docker-compose.prod.yml exec postgres-prod \
  psql -U eac_prod -d elkdonis_production

# Check tables
\dt
```

### Port conflicts

If ports are in use:

```bash
# Check what's using port 3014
sudo netstat -tulpn | grep 3014

# Stop dev services if needed
docker compose down
```

---

## Migration to Remote Server

When ready to deploy to another server:

1. **Archive production config**:
   ```bash
   tar czf eac-production-config.tar.gz \
     .env.production \
     docker-compose.prod.yml \
     apps/inner-gathering/Dockerfile
   ```

2. **Follow MIGRATION-GUIDE.md** for deployment to new server

3. **Key differences**:
   - Update `.env.production` with new server IPs/domains
   - Connect to different Nextcloud instance
   - Setup SSL/reverse proxy
   - Use production domain instead of IP

---

## Security Notes

### Production Secrets (Generated)

All secrets in `.env.production` are cryptographically secure:
- `JWT_SECRET`: 64-byte random
- `REALTIME_SECRET`: 64-byte random
- `POSTGRES_PASSWORD`: 32-byte random
- `NEXTCLOUD_OIDC_SECRET`: 32-byte random
- `INTER_APP_JWT_SECRET`: 32-byte random

### ⚠️ Important

- Never commit `.env.production` to git
- Never share secrets publicly
- Regenerate secrets for actual remote deployment
- Current secrets are for local testing only

---

## Cleanup

### Stop and Remove Everything

```bash
# Stop containers
./scripts/stop-production.sh

# Remove volumes (deletes all production data)
docker compose -f docker-compose.prod.yml down -v

# Remove images
docker rmi $(docker images | grep eac.*prod | awk '{print $3}')
```

---

## Summary

✅ **Production environment** ready for local testing
✅ **Fresh database** - no data migration needed
✅ **Optimized build** - 70% less memory than dev
✅ **Secure secrets** - production-grade credentials
✅ **Separate ports** - runs alongside dev environment
✅ **Same Nextcloud** - connects to existing instance
✅ **Ready to deploy** - test before moving to remote server

**Next Steps:**
1. Build: `./scripts/build-production.sh`
2. Start: `./scripts/start-production.sh`
3. Migrate: `./scripts/migrate-production.sh`
4. Test: http://192.168.0.24:3014
5. Deploy: See MIGRATION-GUIDE.md
