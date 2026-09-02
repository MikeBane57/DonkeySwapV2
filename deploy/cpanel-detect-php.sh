#!/usr/bin/env bash
# Detect PHP and Composer on cPanel hosts (Bluehost, HostGator, etc.).
# Source from other scripts: source deploy/cpanel-detect-php.sh
#
# Optional overrides (e.g. GitHub Actions secrets exported before sourcing):
#   PHP_BIN=/path/to/php COMPOSER_BIN=/path/to/composer source deploy/cpanel-detect-php.sh

if [ -n "${PHP_BIN:-}" ] && [ -x "$PHP_BIN" ]; then
    PHP="$PHP_BIN"
elif [ -x /opt/cpanel/ea-php84/root/usr/bin/php ]; then
    PHP=/opt/cpanel/ea-php84/root/usr/bin/php
elif command -v ea-php84 >/dev/null 2>&1; then
    PHP=ea-php84
elif command -v php >/dev/null 2>&1; then
    PHP=php
else
    echo "Error: PHP 8.4+ not found. Set PHP_BIN or install ea-php84 in cPanel." >&2
    exit 1
fi

if [ -n "${COMPOSER_BIN:-}" ] && [ -x "$COMPOSER_BIN" ]; then
    COMPOSER="$COMPOSER_BIN"
elif [ -x /opt/cpanel/composer/bin/composer ]; then
    COMPOSER=/opt/cpanel/composer/bin/composer
elif command -v composer >/dev/null 2>&1; then
    COMPOSER=composer
else
    echo "Error: Composer not found. Set COMPOSER_BIN or install Composer in cPanel." >&2
    exit 1
fi

export PHP COMPOSER
