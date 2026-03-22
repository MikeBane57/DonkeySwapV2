#!/usr/bin/env bash
# Run this on Bluehost (via SSH or cPanel Terminal) from the app root, or from the deploy/ folder.
# Usage: ./deploy/server-deploy.sh   (from app root)
#    or: bash deploy/server-deploy.sh

set -e

# App root = parent of deploy/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

echo "==> Deploying from $APP_DIR"

echo "==> Git pull..."
git pull origin main

echo "==> Composer install..."
composer install --no-dev --optimize-autoloader --no-interaction

# No Node.js on this server: build frontend locally (npm ci && npm run build) and upload public/build to server's public/ folder.

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Cache config and routes..."
php artisan config:cache
php artisan route:cache

echo "==> Done."
