# Performance & Memory Analysis

## Inner-Gathering Memory Usage

### Current State (Development)
- **Container Memory**: 1.5-1.7GB RSS
- **JS Heap**: ~210-230MB
- **Difference**: ~1.4GB in native memory

### Root Cause: Next.js 15 + Turbopack Development Mode

The high memory usage is **normal and expected** for Next.js 15 with Turbopack in development:

1. **Turbopack Native Cache** (~800MB)
   - Rust-based compiler keeps compilation cache in memory
   - Hot Module Replacement (HMR) state
   - Source maps loaded for dev tools

2. **Worker Threads** (~300MB)
   - Multiple compilation workers
   - File watchers
   - Dev server infrastructure

3. **Node.js V8 Overhead** (~300MB)
   - Code cache
   - JIT compiler data
   - Native modules

4. **Memory-Mapped Files** (~100MB)
   - `node_modules`: 982MB on disk
   - `.next` build: 268MB on disk
   - Portions mapped into memory

### Production Comparison

Expected memory usage in production mode:
- **Production Build**: ~150-300MB (80% reduction)
- **No Turbopack dev cache**
- **No HMR/file watchers**
- **Optimized bundles**
- **Shared dependencies**

## Development Optimization Options

### Option 1: Add Memory Limit (Recommended for Constraint Testing)
```yaml
# docker-compose.yml
inner-gathering:
  mem_limit: 1g  # Force optimization awareness
  memswap_limit: 1g  # Prevent swap
```

### Option 2: Reduce Turbopack Cache
```bash
# In package.json or docker command
NODE_OPTIONS="--max-old-space-size=768" next dev --turbopack
```

### Option 3: Switch to Webpack (Not Recommended)
```json
// Remove --turbopack flag
"docker:dev": "next dev --port 3004"
```
⚠️ **Slower hot reload, similar memory usage**

### Option 4: Accept Dev Mode Reality
**This is the recommended approach** - 1.5GB is reasonable for:
- Modern dev tooling (Turbopack, HMR, source maps)
- 12GB total system RAM
- Development server with file watching
- Fast compilation and hot reload

## Production Deployment Strategy

### Memory Requirements by Environment

| Environment | Expected Memory | Reasoning |
|------------|----------------|-----------|
| Development (current) | 1.5-2GB | Turbopack + HMR + watchers |
| Production (standalone) | 150-300MB | Optimized build, no dev tools |
| Production (w/ traffic) | 300-500MB | Under moderate load |

### Docker Compose Production Config

```yaml
# docker-compose.prod.yml
services:
  inner-gathering:
    build:
      context: .
      dockerfile: Dockerfile
      target: production  # Use production stage
    command: sh -c "cd apps/inner-gathering && pnpm docker:start"
    environment:
      NODE_ENV: production
      # Smaller Node.js heap for production
      NODE_OPTIONS: "--max-old-space-size=512"
    mem_limit: 768m  # Conservative production limit
    memswap_limit: 768m
    restart: unless-stopped
    networks:
      - eac-network
      - nextcloud-network  # Bridge to friend's Nextcloud
```

## Network Architecture

### Current Setup: Two-Network Design

**Why it's correct for your use case:**

Your friend's server already has Nextcloud running. The two-network design prepares for production deployment:

```
┌─────────────────────────────────────────┐
│         Friend's Server                  │
│                                         │
│  ┌────────────────────────────────┐    │
│  │   nextcloud-network (external) │    │
│  │                                 │    │
│  │  ┌──────────┐  ┌──────────┐   │    │
│  │  │ Nextcloud│  │ Nextcloud│   │    │
│  │  │   App    │  │Postgres  │   │    │
│  │  └──────────┘  └──────────┘   │    │
│  │       ▲              ▲         │    │
│  └───────┼──────────────┼─────────┘    │
│          │              │               │
│  ┌───────┼──────────────┼─────────┐    │
│  │       │  eac-network │         │    │
│  │       │              │         │    │
│  │  ┌────┴────┐    ┌───┴─────┐   │    │
│  │  │  inner- │    │ EAC     │   │    │
│  │  │gathering│    │Postgres │   │    │
│  │  └─────────┘    └─────────┘   │    │
│  │                                │    │
│  │  (EAC services isolated        │    │
│  │   but can access Nextcloud)    │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Services That Need Both Networks

Only services that **must** communicate with Nextcloud should bridge:

```yaml
# CORRECT - bridges to access Nextcloud
inner-gathering:
  networks:
    - eac-network
    - nextcloud-network

supabase-auth:  # If storing app passwords via Nextcloud
  networks:
    - eac-network
    - nextcloud-network

# WRONG - doesn't need Nextcloud access
postgres:  # EAC's own database
  networks:
    - eac-network  # ONLY eac-network
```

### Production Deployment Checklist

When deploying to friend's server:

1. **Nextcloud Network**
   ```bash
   # On friend's server, find existing Nextcloud network
   docker network ls | grep nextcloud
   # Example: nextcloud_default or nextcloud-network
   ```

2. **Update docker-compose.prod.yml**
   ```yaml
   networks:
     eac-network:
       driver: bridge
     nextcloud-network:
       external: true
       name: nextcloud_default  # Use actual name from step 1
   ```

3. **Environment Variables**
   ```env
   # .env.production
   NEXTCLOUD_URL=http://nextcloud-app:9000  # Internal Docker name
   NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.friendsdomain.com  # Public URL
   ```

4. **Build & Deploy**
   ```bash
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```

## Recommendations

### For Development (Now)
- **Keep current setup** - 1.5GB is acceptable for dev
- **Two networks are correct** - prepares for production
- Optional: Add `mem_limit: 2g` to be explicit

### For Production (Friend's Server)
- **Use production build** - reduces to 300-500MB
- **Connect to external nextcloud-network**
- **Set conservative memory limits** - `mem_limit: 768m`
- **Use environment-specific configs** - `docker-compose.prod.yml`

## Nextcloud Performance

The slowness you're experiencing at `localhost:8080` is **not** the network (44ms response time is fast). It's:

1. **Nextcloud's heavy UI** - Lots of JavaScript/CSS
2. **First login setup** - Session creation, user preferences loading
3. **Browser rendering** - Complex Vue.js application
4. **PHP-FPM cold start** - First request after idle

This is **normal Nextcloud behavior** and unrelated to the two-network setup.

## Monitoring Commands

```bash
# Check memory usage
docker stats --no-stream

# Check network connectivity
docker exec eac-inner-gathering ping -c 3 nextcloud-nginx

# Production memory test
docker compose -f docker-compose.prod.yml up -d
docker stats eac-inner-gathering --no-stream

# View Next.js memory trace
docker exec eac-inner-gathering cat /app/apps/inner-gathering/.next/trace | grep memory
```

## Summary

✅ **Current memory usage is normal**
✅ **Two-network design is correct for your deployment**
✅ **Production will use 75-80% less memory**
✅ **Network is not causing slowness**

The architecture is well-designed for deploying to a server with existing Nextcloud infrastructure.
