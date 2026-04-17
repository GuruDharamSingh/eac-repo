# Elkdonis Arts Collective - Multi-Organization Platform

Self-hosted network of interconnected apps with shared authentication and content aggregation.

## Architecture

**Single-schema PostgreSQL design:**
- One database (`elkdonis_dev`) with public schema
- All content tables include `org_id` for filtering
- Each app queries same database, filtered to its organization
- Forum aggregates across all orgs

**Stack:**
- Next.js 15 (App Router) + React 19
- PostgreSQL 16 + Supabase GoTrue (auth)
- Nextcloud 29 (file storage)
- Redis (cache)
- Turborepo monorepo (pnpm workspaces)

## Apps

```
apps/
├── admin/                       Port 3000 - Admin dashboard
├── blog-sunjay/                 Port 3001 - Personal blog (org: sunjay)
├── blog-guru-dharam/            Port 3002 - Personal blog (org: guru-dharam)
├── forum/                       Port 3003 - Cross-org content aggregator
├── inner-gathering/             Port 3004 - Mobile-first community app
├── elkdonis-arts-collective/    Port 3005 - Public landing + workshops showcase
└── amrit-canada/                Port 3006 - Community app (org: amrit_canada)
```

## Database Schema

**Core tables:**
```
organizations           Communities within the network
users                   Shared user accounts (UUID from Supabase)
user_organizations      Membership + roles (guide/member/viewer)
topics                  Hierarchical tags
```

**Content tables:**
```
posts                   Blog posts (title, body, slug, visibility)
meetings                Events (scheduling, RSVP, location)
replies                 Polymorphic comments (post/meeting/reply)
media                   Nextcloud-backed attachments
```

**System tables:**
```
events                  Activity audit log
app_schema_migrations   Migration runner state (filename + checksum)
post_topics             Post-tag junction
meeting_topics          Meeting-tag junction
meeting_attendees       RSVP tracking
```

**Forum engagement tables:**
```
reactions               Likes/upvotes (polymorphic)
watches                 Thread subscriptions
notifications           User alerts (reply/mention/reaction)
bookmarks               Saved content
flags                   Content reports
moderation_log          Audit trail of mod actions
```

## Shared Packages

```
packages/
├── db/                 PostgreSQL client + schema setup
├── auth/               Supabase auth wrapper
├── types/              TypeScript definitions
├── ui/                 Shared React components
├── hooks/              React hooks
├── services/           Business logic layer
├── utils/              Helper functions
├── nextcloud/          Nextcloud API client
├── config/             Shared configuration
└── events/             Event system utilities
```

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
pnpm install

# Run migrations
docker exec -i eac-postgres psql -U postgres -d elkdonis_dev < packages/db/migrations/001_core_schema.sql

# Start all apps
pnpm dev

# Or start individual app
cd apps/inner-gathering && pnpm dev
```

**Access:**
- Inner Gathering: http://localhost:3004
- Forum: http://localhost:3003
- Admin: http://localhost:3000
- Nextcloud: http://localhost:8080
- Supabase Auth: http://localhost:9999

## Content Flow

1. User signs in (Supabase GoTrue)
2. User creates post/meeting in their org app
3. Content stored with `org_id` filter
4. Forum queries across all orgs (filtered by visibility)
5. Users react, comment, bookmark
6. Events logged for audit trail

## Configuration

See `.env` for:
- `DATABASE_URL` - PostgreSQL connection
- `SUPABASE_URL` + `JWT_SECRET` - Auth config
- `NEXTCLOUD_URL` + credentials - File storage

## Production Deployment

### Prerequisites
- Docker and Docker Compose installed
- Git access to this repository
- Production server with Ubuntu/Linux
- Nextcloud instance running

### Security Setup (DO FIRST)

1. **Generate production secrets:**
```bash
./scripts/generate-secrets.sh
```

2. **Create `.env.production`:**
```bash
cp .env.production.example .env.production
# Edit and fill in generated secrets
nano .env.production
```

3. **Update `SERVER_HOST`** in `.env.production` with your server's IP address

### Deploy on Production Server

1. **Clone repository:**
```bash
git clone <your-repo-url> /opt/eac
cd /opt/eac
```

2. **Copy your `.env.production` to the server** (use SCP, SFTP, or create it directly)

3. **Ensure Nextcloud Docker network exists:**
```bash
docker network create nextcloud-network
```

4. **Build and start services:**
```bash
docker-compose -f docker-compose.production.yml up -d --build
```

5. **Run database migrations:**
```bash
docker-compose -f docker-compose.production.yml exec admin sh -c "cd /app && node packages/db/scripts/migrate.js"
```

6. **Verify services are running:**
```bash
docker-compose -f docker-compose.production.yml ps
```

7. **Check logs:**
```bash
docker-compose -f docker-compose.production.yml logs -f
```

### Accessing Apps

Without domains, access via IP:port:
- Admin: `http://YOUR_SERVER_IP:3000`
- Inner Gathering: `http://YOUR_SERVER_IP:3004`
- Blog Sunjay: `http://YOUR_SERVER_IP:3001`
- Blog Guru Dharam: `http://YOUR_SERVER_IP:3002`
- Forum: `http://YOUR_SERVER_IP:3003`
- Landing Page: `http://YOUR_SERVER_IP:3005`

### Troubleshooting

**Services won't start:**
```bash
# Check if Nextcloud network exists
docker network ls | grep nextcloud

# Check if ports are available
sudo netstat -tulpn | grep 3000
```

**Database connection errors:**
```bash
# Verify postgres is running
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Check environment variables are loaded
docker-compose -f docker-compose.production.yml exec admin env | grep DATABASE_URL
```

**Can't access apps from browser:**
```bash
# Check firewall allows ports
sudo ufw status

# Open ports if needed
sudo ufw allow 3000:3005/tcp
```

---

**Built for spiritual communities to share teachings, coordinate gatherings, and collaborate.**
