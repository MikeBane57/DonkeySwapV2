<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ContentSecurityPolicy
{
    /**
     * Set a Content-Security-Policy header that allows Inertia, Vite, and
     * inline scripts (e.g. theme detection) to run. Required when the host
     * or server sends a strict CSP that blocks script-src.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval'";
        $connectSrc = "'self'";

        if (app()->environment('local')) {
            $host = $request->getHost();
            $viteOrigin = "http://{$host}:5173";
            $scriptSrc .= " {$viteOrigin}";
            $connectSrc .= " {$viteOrigin} ws://{$host}:5173 wss://{$host}:5173";
            // Allow localhost:5173 so Vite HMR works when app is opened via IP but dev server is on localhost
            if ($host !== 'localhost' && $host !== '127.0.0.1') {
                $connectSrc .= " http://localhost:5173 http://127.0.0.1:5173 ws://localhost:5173 wss://localhost:5173 ws://127.0.0.1:5173 wss://127.0.0.1:5173";
            }
        }

        $directives = [
            "default-src 'self'",
            "script-src {$scriptSrc}",
            "style-src 'self' 'unsafe-inline' https://fonts.bunny.net",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https://fonts.bunny.net",
            "connect-src {$connectSrc}",
            "frame-ancestors 'self'",
        ];

        $response->headers->set('Content-Security-Policy', implode('; ', $directives));

        return $response;
    }
}
