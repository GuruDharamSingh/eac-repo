#!/bin/bash
# ==================================================================
# Build Production Environment
# ==================================================================
# This script builds the production Docker images for testing
# ==================================================================

set -e  # Exit on error

echo "🚀 Building Production Environment..."
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production not found"
    echo "Run: cp .env.production.example .env.production"
    echo "Then edit .env.production with your values"
    exit 1
fi

# Load production environment
export $(cat .env.production | grep -v '^#' | xargs)

echo "📦 Building shared packages..."
pnpm --filter @elkdonis/db build
pnpm --filter @elkdonis/types build
pnpm --filter @elkdonis/utils build
pnpm --filter @elkdonis/nextcloud build
pnpm --filter @elkdonis/auth-client build
pnpm --filter @elkdonis/auth-server build
pnpm --filter @elkdonis/services build
pnpm --filter @elkdonis/hooks build
pnpm --filter @elkdonis/ui build

echo ""
echo "🐳 Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "✅ Production build complete!"
echo ""
echo "Next steps:"
echo "  1. Start services: ./scripts/start-production.sh"
echo "  2. Run migrations: ./scripts/migrate-production.sh"
echo "  3. Test at: http://192.168.0.24:3014"
echo ""
