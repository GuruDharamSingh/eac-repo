# Docker Setup - Next Steps

## Current Status
✅ Docker configuration files ready (docker-compose.yml, Dockerfile, .env)
✅ Database package with migration scripts ready
✅ All code prepared and transferred to Ubuntu VM

## What's Left To Do

### 1. On Ubuntu VM - Install Prerequisites
```bash
# Install Node.js and pnpm (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# Verify Docker is running
docker --version
docker-compose --version
```

### 2. Navigate to Project
```bash
cd ~/eac-repo  # (or wherever you transferred the files)
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Build Shared Packages
```bash
pnpm --filter @elkdonis/db build
pnpm --filter @elkdonis/ui build
```

### 5. Start Docker Services
```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Supabase Auth (port 9999)
- Supabase Realtime (port 4000)
- Nextcloud + Nginx (port 8080)
- Redis (port 6379)
- Admin app (port 3000)
- Forum app (port 3003)
- Blog-sunjay (port 3001)
- Blog-guru-dharam (port 3002)

### 6. Wait for PostgreSQL
```bash
# Check if postgres is healthy
docker-compose ps

# Watch logs to see when postgres is ready
docker-compose logs -f postgres
```

Wait until you see: `database system is ready to accept connections`

### 7. Run Database Migrations
```bash
# This creates all schemas and seeds organizations
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate
```

Expected output:
```
🔨 Setting up database schemas...
📁 Creating schema for Elkdonis Arts Collective...
✅ Schema org_elkdonis created
📁 Creating schema for Sunjay's Blog...
✅ Schema org_sunjay created
📁 Creating schema for Guru Dharam's Blog...
✅ Schema org_guru-dharam created
✅ Database setup complete
```

### 8. Verify Services
```bash
# Check all containers are running
docker-compose ps

# Should see all services with status "Up"
```

### 9. One-Time Nextcloud Setup
1. Visit `http://localhost:8080` (or VM-IP:8080 from Windows)
2. Login with credentials from `.env`:
   - Username: `admin`
   - Password: `admin_dev_password`
3. Nextcloud will auto-configure with PostgreSQL
4. Create a shared folder for media uploads (optional, for later)

### 10. Access Applications
- **Admin Dashboard**: http://localhost:3000
- **Sunjay's Blog**: http://localhost:3001
- **Guru Dharam's Blog**: http://localhost:3002
- **Community Forum**: http://localhost:3003
- **Nextcloud**: http://localhost:8080

(Replace `localhost` with your VM's IP if accessing from Windows)

---

## Troubleshooting

### If containers fail to start:
```bash
docker-compose logs <service-name>
# Example: docker-compose logs postgres
```

### If migration fails:
```bash
# Check postgres is running
docker-compose exec postgres psql -U postgres -d elkdonis_dev -c '\l'

# Manually run migration with more detail
docker-compose exec admin sh -c "cd packages/db && pnpm db:migrate"
```

### Reset everything and start over:
```bash
docker-compose down -v  # WARNING: Deletes all data
docker-compose up -d
```

---

## After Setup Complete

### Still To Implement:
- 🚧 Authentication (currently using placeholder user IDs)
- 🚧 Media upload to Nextcloud (TODO in code)
- 🚧 Admin UI for approving forum posts
- 🚧 Forum post display (basic UI exists, needs enhancement)
- 🚧 Update `.env` with real credentials after services initialize

### Development Workflow:
```bash
# View all logs
docker-compose logs -f

# Restart a specific service
docker-compose restart blog-sunjay

# Rebuild after code changes
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v
```

---

## Using Claude Code

**Yes, you can use both CLI and VSCode agents!**

- **VSCode Agent** (when SSH'd into VM): Best for editing files, running commands on VM
- **CLI Agent** (on Windows): Can still help with planning, documentation, code review

Both agents can work on the same project - just make sure you're aware which environment you're in.

For Docker operations, use the **VSCode agent** while connected to the Ubuntu VM via Remote SSH.

---

## Questions?

If anything fails, check:
1. Docker is running: `sudo systemctl status docker`
2. Ports aren't in use: `sudo netstat -tulpn | grep :3000`
3. Enough disk space: `df -h`
4. Logs for errors: `docker-compose logs <service>`
