#!/bin/bash
# ==================================================================
# Run Production Database Migrations
# ==================================================================

set -e

echo "🔨 Running Database Migrations (Production)..."
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

# Run migrations
docker compose -f docker-compose.prod.yml exec inner-gathering-prod \
    sh -c "cd /app/packages/db && pnpm db:migrate"

echo ""
echo "✅ Migrations complete!"
echo ""
