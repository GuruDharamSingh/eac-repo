#!/bin/bash
# ==================================================================
# Start Production Environment
# ==================================================================

set -e

echo "🚀 Starting Production Services..."
echo ""

# Load environment
export $(cat .env.production | grep -v '^#' | xargs)

# Start services
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check status
docker compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Production services started!"
echo ""
echo "Access points:"
echo "  - Inner Gathering: http://192.168.0.24:3014"
echo "  - Supabase Auth:   http://192.168.0.24:9997"
echo "  - PostgreSQL:      localhost:5433"
echo "  - Redis:           localhost:6380"
echo ""
echo "View logs: docker compose -f docker-compose.prod.yml logs -f"
echo "Stop services: ./scripts/stop-production.sh"
echo ""
