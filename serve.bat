@echo off
REM Workaround for "Failed to listen (reason: ?)" when using php artisan serve on Windows.
REM This runs PHP's built-in server directly; Laravel routing still works.
echo Starting Laravel at http://127.0.0.1:8080 (and http://YOUR_IP:8080 from other devices)...
php -S 0.0.0.0:8080 -t public
