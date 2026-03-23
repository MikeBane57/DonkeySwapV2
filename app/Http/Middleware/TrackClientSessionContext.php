<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class TrackClientSessionContext
{
    private const COOKIE = 'ds_client_ctx';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (config('session.driver') !== 'database') {
            return $response;
        }

        if (! $request->user()) {
            return $response;
        }

        $sessionId = $request->session()->getId();
        if ($sessionId === '') {
            return $response;
        }

        [$displayMode, $platform] = $this->resolveContext($request);

        $table = (string) config('session.table', 'sessions');

        DB::table($table)->where('id', $sessionId)->update([
            'client_display_mode' => $displayMode,
            'client_platform' => $platform !== '' ? $platform : null,
        ]);

        return $response;
    }

    /**
     * @return array{0: string|null, 1: string}
     */
    private function resolveContext(Request $request): array
    {
        $headerMode = $request->header('X-Client-Display-Mode');
        $headerPlatform = $request->header('X-Client-Platform');

        if (is_string($headerMode) && $headerMode !== '') {
            $mode = mb_substr(trim($headerMode), 0, 32);
            $pf = is_string($headerPlatform) ? mb_substr(trim($headerPlatform), 0, 64) : '';

            return [$mode !== '' ? $mode : null, $pf];
        }

        $raw = $request->cookie(self::COOKIE);
        if (! is_string($raw) || $raw === '') {
            return [null, ''];
        }

        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            $decoded = json_decode(rawurldecode($raw), true);
        }
        if (! is_array($decoded)) {
            return [null, ''];
        }

        $dm = $decoded['dm'] ?? null;
        $pf = $decoded['pf'] ?? '';

        $mode = is_string($dm) ? mb_substr(trim($dm), 0, 32) : null;
        $plat = is_string($pf) ? mb_substr(trim($pf), 0, 64) : '';

        return [$mode !== '' ? $mode : null, $plat];
    }
}
