# Production Deployment Overview

## Three Deployment Scenarios

### 1. **Local Production Testing** (This Machine)
📍 **Current**: Test production build on 192.168.0.24
📄 **Guide**: `PRODUCTION-SETUP.md`
🎯 **Purpose**: Verify production build works before deploying elsewhere

```bash
./scripts/build-production.sh
./scripts/start-production.sh
./scripts/migrate-production.sh
# Test at http://192.168.0.24:3014
```

### 2. **Remote Server Deployment** (New Server)
📍 **Target**: Deploy to friend's server with different Nextcloud
📄 **Guide**: `MIGRATION-GUIDE.md`
🎯 **Purpose**: Production deployment on remote infrastructure

### 3. **Keep Development** (Current Setup)
📍 **Current**: Continue using dev environment on 192.168.0.24
📄 **Guide**: `CLAUDE.md`, `SETUP-NEXT-STEPS.md`
🎯 **Purpose**: Active development with hot reload

---

## Data Migration: **NOT REQUIRED**

All deployments start with a **fresh database**:
- ✅ Run migrations to create tables
- ✅ Create test users fresh
- ✅ No data to transfer
- ✅ Clean start every time

**Why?**
- Development data is test/demo only
- Production starts clean with real users
- Migrations handle all schema setup
- No legacy data to worry about

---

## Quick Decision Guide

**Want to...**

| Goal | Use | Guide |
|------|-----|-------|
| Test production build locally | Local Production Testing | PRODUCTION-SETUP.md |
| Deploy to friend's server | Remote Server Deployment | MIGRATION-GUIDE.md |
| Continue development | Keep Development | CLAUDE.md |
| Test memory optimization | Local Production Testing | PRODUCTION-SETUP.md |
| Connect to different Nextcloud | Remote Server Deployment | MIGRATION-GUIDE.md |

---

## What's in Each Guide?

### PRODUCTION-SETUP.md
- Build production on **this machine**
- Test optimized build locally
- Fresh database (no migration)
- Different ports (no conflicts)
- ~5 minutes to setup

### MIGRATION-GUIDE.md
- Deploy to **different server**
- Connect to **different Nextcloud**
- Domain/SSL configuration
- Reverse proxy setup
- ~2-3 hours to deploy

### CLAUDE.md
- Development workflow
- Architecture overview
- Database conventions
- Troubleshooting
- Development commands

---

## Common Questions

**Q: Do I need to copy data from dev to production?**
A: **No**. Production starts fresh. Migrations create tables, users create new data.

**Q: Can production and dev run at the same time?**
A: **Yes**. Production uses different ports (3014 vs 3004, 5433 vs 5432).

**Q: Does production use the same Nextcloud?**
A: **Local**: Yes. **Remote**: No - connects to different Nextcloud instance.

**Q: Will production mess up my dev environment?**
A: **No**. Completely separate containers, networks, and databases.

**Q: How do I test production before deploying?**
A: Run local production (PRODUCTION-SETUP.md), test thoroughly, then deploy (MIGRATION-GUIDE.md).

**Q: What if I want to switch back to dev?**
A: Stop production (`./scripts/stop-production.sh`), dev keeps running unchanged.

---

## Recommended Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Develop Features (Dev Environment)                  │
│    - Hot reload, source maps                            │
│    - Test data, quick iteration                         │
│    - Port 3004                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Test Production Build (Local)                       │
│    - Run: ./scripts/build-production.sh                │
│    - Optimized build, production secrets                │
│    - Port 3014                                          │
│    - Verify: memory, features, performance              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Deploy to Remote Server                             │
│    - Follow MIGRATION-GUIDE.md                          │
│    - Connect to friend's Nextcloud                      │
│    - Setup SSL, domain                                  │
│    - Fresh production database                          │
└─────────────────────────────────────────────────────────┘
```

---

## Files Overview

```
eac-repo/
├── .env                        # Development config
├── .env.production             # Production config (local/remote)
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
│
├── CLAUDE.md                   # Development guide
├── PRODUCTION-SETUP.md         # ← Local production testing
├── MIGRATION-GUIDE.md          # ← Remote server deployment
│
├── scripts/
│   ├── build-production.sh     # Build production images
│   ├── start-production.sh     # Start production services
│   ├── stop-production.sh      # Stop production services
│   ├── migrate-production.sh   # Run production migrations
│   └── status-production.sh    # Check production status
│
└── apps/inner-gathering/
    └── Dockerfile              # Production build config
```

---

## Next Steps

**To test production locally:**
```bash
cd /home/elkdonis/dev-enviroment/eac-repo
./scripts/build-production.sh
./scripts/start-production.sh
./scripts/migrate-production.sh
```

**To deploy to remote server:**
```bash
# Read first
cat MIGRATION-GUIDE.md
```

**To continue development:**
```bash
# Keep using dev environment as normal
docker compose up -d
```

---

✅ All documentation ready
✅ Scripts prepared
✅ Production configs generated
✅ No data migration needed
✅ Ready to test or deploy
