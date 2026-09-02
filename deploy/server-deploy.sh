#!/usr/bin/env bash
# Run on cPanel hosting (Bluehost, HostGator, etc.) via SSH or cPanel Terminal.
# Usage: ./deploy/server-deploy.sh   (from app root)
#    or: bash deploy/server-deploy.sh

set -e

# App root = parent of deploy/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

# shellcheck source=cpanel-detect-php.sh
source "$SCRIPT_DIR/cpanel-detect-php.sh"

echo "==> Deploying from $APP_DIR (PHP: $PHP)"

echo "==> Git pull..."
git pull origin main

echo "==> Composer install..."
$PHP $COMPOSER install --no-dev --optimize-autoloader --no-interaction

# No Node.js on this server: build frontend locally (npm ci && npm run build) and upload public/build to server's public/ folder.

echo "==> Running migrations..."
$PHP artisan migrate --force

echo "==> Optimize (config, events, routes, views)..."
$PHP artisan optimize

echo "==> Done."
