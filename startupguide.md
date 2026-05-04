# EAC Startup Guide

This guide explains how to start the core services and verify that the apps on ports **3000** and **3007** are running correctly.

## 1. Start the Services
Run this command from the `dev-enviroment/eac-repo` directory to start the infrastructure and the specific apps:

```bash
docker compose up -d admin arts-collective postgres supabase-auth supabase-rest supabase-realtime redis
```

## 2. Run Database Migrations
Ensure the database schema is up to date:

```bash
docker compose exec admin pnpm --filter @elkdonis/db db:migrate
```

## 3. Verify They Are Running

### Check Container Status
All containers should show "Up" or "Healthy":
```bash
docker compose ps
```

### View Live Logs
To see if the Next.js servers are ready:
- **Admin (3000):** `docker compose logs -f admin`
- **Arts Collective (3007):** `docker compose logs -f arts-collective`

### Access in Browser
Once the logs show `✓ Ready`, you can visit:
- **Admin Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Arts Collective:** [http://localhost:3007](http://localhost:3007)

## 4. Stopping Services
To stop everything safely:
```bash
docker compose stop
```
(Use `docker compose down` only if you want to remove the containers entirely.)
