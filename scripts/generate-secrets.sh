#!/bin/bash
# Generate cryptographically secure secrets for production
# Run this script and copy output to .env.production

set -e  # Exit if any command fails

echo "==================================================================="
echo "Production Secret Generator"
echo "==================================================================="
echo ""
echo "Copy these secrets to your .env.production file"
echo "KEEP THESE SECRET - do not commit to git or share publicly"
echo ""

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "ERROR: openssl not installed"
    echo "Install it: sudo apt install openssl"
    exit 1
fi

echo "# Generated $(date)"
echo ""
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "REALTIME_SECRET=$(openssl rand -base64 96)"
echo "NEXTCLOUD_ADMIN_PASSWORD=$(openssl rand -base64 32)"
echo "NEXTCLOUD_OIDC_SECRET=$(openssl rand -base64 32)"
echo "NEXTCLOUD_WEBHOOK_SECRET=$(openssl rand -base64 32)"
echo "SUPABASE_SERVICE_KEY=$(openssl rand -base64 48)"
echo ""
echo "==================================================================="
echo "Copy the output above to .env.production"
echo "Store a backup in a secure password manager"
echo "==================================================================="
