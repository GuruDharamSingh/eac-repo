#!/bin/bash
# ==================================================================
# Run Production Database Migrations
# ==================================================================

set -e

echo "🔨 Database migrations (Production)..."
echo ""

# Check if postgres is running
if ! docker compose -f docker-compose.prod.yml ps postgres-prod | grep -q "Up"; then
    echo "❌ Error: PostgreSQL is not running"
    echo "Start services first: ./scripts/start-production.sh"
    exit 1
fi

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "⚠️  Nothing was run: docker-compose.prod.yml has no app service to run migrations in (the inner-gathering service was retired)."
echo "   Apply migrations with packages/db/scripts/migrate.mjs against the production database (DATABASE_URL set)."

echo ""
echo "ℹ️  No migrations were applied by this script."
echo ""
