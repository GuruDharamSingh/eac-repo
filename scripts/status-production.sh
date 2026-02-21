#!/bin/bash
# ==================================================================
# Check Production Environment Status
# ==================================================================

echo "📊 Production Environment Status"
echo "=================================="
echo ""

echo "🐳 Docker Containers:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "💾 Memory Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}" \
    $(docker compose -f docker-compose.prod.yml ps -q 2>/dev/null) 2>/dev/null || echo "No running containers"

echo ""
echo "📈 Disk Usage (Volumes):"
docker volume ls --filter name=eac-repo | grep prod || echo "No production volumes"

echo ""
echo "🌐 Endpoints:"
echo "  - Inner Gathering: http://192.168.0.24:3014"
echo "  - Supabase Auth:   http://192.168.0.24:9997"
echo "  - API Health:      http://192.168.0.24:3014/api/live/current"
echo ""

echo "📝 View Logs:"
echo "  - All:    docker compose -f docker-compose.prod.yml logs -f"
echo "  - App:    docker compose -f docker-compose.prod.yml logs -f inner-gathering-prod"
echo "  - DB:     docker compose -f docker-compose.prod.yml logs -f postgres-prod"
echo ""
