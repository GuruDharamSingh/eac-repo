# Docker Development Environment Setup

## Architecture Overview

Your self-hosted development environment includes:

- **PostgreSQL** (Port 5432): Multi-tenant database system
- **Supabase** (Auth: 9999, Realtime: 4000): Authentication & WebSocket services only
- **Nextcloud** (via Nginx): Media storage and file management system
- **Redis** (Port 6379): Caching and session management
- **Nginx** (Ports 80/443): Reverse proxy for routing between services
- **pgAdmin** (Port 5050): Database administration
- **Next.js App** (Port 3000): Main application

## Key Design Decisions

### 1. **Cloud-based Email (Not Self-hosted)**
- Configure with SendGrid, AWS SES, Postmark, or similar
- Update SMTP settings in `.env` with your provider credentials

### 2. **Nextcloud for Media Storage**
- Optimized for large file uploads (10GB limit)
- FPM configuration for better performance with Nginx
- Optional S3-compatible external storage support
- Accessible via `storage.localhost` subdomain

### 3. **Nginx as Central Router**
- Routes traffic between Next.js app and Nextcloud
- Handles large media uploads efficiently
- Security headers and rate limiting configured
- WebSocket support for real-time features

## Quick Start

1. **Setup environment:**
   ```bash
   cp .env.docker .env
   # Edit .env to add your cloud SMTP credentials
   ```

2. **Add to hosts file (Windows: C:\Windows\System32\drivers\etc\hosts):**
   ```
   127.0.0.1 localhost
   127.0.0.1 storage.localhost
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Initialize databases:**
   ```bash
   # Wait for services to be healthy
   docker-compose exec app pnpm --filter @elkdonis/db db:push
   ```

5. **Access services:**
   - Main App: http://localhost
   - Media Storage: http://storage.localhost
   - pgAdmin: http://localhost:5050
   - Direct App Access: http://localhost:3000

## Email Configuration

Replace the generic SMTP settings in `.env` with your provider:

### SendGrid:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### AWS SES:
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-ses-smtp-username
SMTP_PASS=your-aws-ses-smtp-password
```

## Multi-Tenant Database Structure

PostgreSQL creates separate databases:
- `elkdonis_dev` - Main application
- `elkdonis_main` - Shared tenant data
- `elkdonis_tenant_1`, `elkdonis_tenant_2` - Tenant-specific databases
- `nextcloud` - Media storage metadata

## Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f nginx
docker-compose logs -f app

# Restart after config changes
docker-compose restart nginx

# Database operations
docker-compose exec app pnpm --filter @elkdonis/db db:studio
docker-compose exec app pnpm --filter @elkdonis/db db:migrate

# Stop services
docker-compose down

# Clean everything
docker-compose down -v
```

## Production Migration Notes

### Architecture Redesign Considerations:

1. **Database Strategy:**
   - Consider managed PostgreSQL (AWS RDS, Google Cloud SQL)
   - Implement proper tenant isolation (schema vs database)
   - Add connection pooling (PgBouncer)

2. **Media Storage:**
   - Migrate Nextcloud data to S3-compatible storage
   - Consider CDN for media delivery (CloudFlare, AWS CloudFront)
   - Implement proper backup strategy

3. **Security Hardening:**
   - Enable SSL/TLS certificates (Let's Encrypt)
   - Implement proper firewall rules
   - Use secrets management (Docker Secrets, Vault)
   - Enable audit logging

4. **Scaling Preparation:**
   - Container orchestration (Kubernetes, Docker Swarm)
   - Load balancing for multiple app instances
   - Redis clustering for high availability
   - Monitoring stack (Prometheus, Grafana)

5. **Multi-tenancy Implementation:**
   - Tenant routing middleware
   - Domain-based tenant identification
   - Resource isolation and quotas
   - Tenant-specific backups

## Troubleshooting

- **Nginx 502 errors:** Check if app/nextcloud containers are running
- **Upload size limits:** Adjust `client_max_body_size` in nginx.conf
- **Database connections:** Ensure PostgreSQL health checks pass
- **Email not sending:** Verify SMTP credentials and firewall rules