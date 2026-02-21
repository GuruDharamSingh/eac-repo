#!/bin/bash
# ==================================================================
# Stop Production Environment
# ==================================================================

echo "🛑 Stopping Production Services..."

docker compose -f docker-compose.prod.yml down

echo ""
echo "✅ Production services stopped!"
echo ""
echo "To remove volumes (WARNING: deletes all data):"
echo "  docker compose -f docker-compose.prod.yml down -v"
echo ""
