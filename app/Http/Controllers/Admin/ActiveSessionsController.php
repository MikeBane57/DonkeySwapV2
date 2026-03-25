<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Client\UserAgentSummary;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ActiveSessionsController extends Controller
{
    private const HISTORY_LIMIT = 500;

    public function index(Request $request, UserAgentSummary $userAgentSummary): Response
    {
        $driver = (string) config('session.driver');
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }

        if ($driver !== 'database') {
            return Inertia::render('admin/active-sessions', [
                'sessions_unavailable' => true,
                'sessions_unavailable_reason' => 'Session storage is not using the database driver, so active sign-ins cannot be listed here. Set SESSION_DRIVER=database in production.',
                'timezone' => $tz,
                'session_lifetime_minutes' => (int) config('session.lifetime', 120),
                'rows' => [],
                'rollup' => [
                    'by_browser' => [],
                    'by_os' => [],
                    'by_display_mode' => [],
                ],
                'current_session_id' => null,
                'total' => 0,
                'history_rows' => [],
                'history_total' => 0,
                'history_limit' => self::HISTORY_LIMIT,
            ]);
        }

        $lifetimeMin = (int) config('session.lifetime', 120);
        $cutoff = CarbonImmutable::now('UTC')->subMinutes($lifetimeMin)->getTimestamp();

        $table = (string) config('session.table', 'sessions');

        $select = [
            "{$table}.id as session_id",
            "{$table}.user_id",
            "{$table}.ip_address",
            "{$table}.user_agent",
            "{$table}.last_activity",
            "{$table}.client_display_mode",
            "{$table}.client_platform",
            'users.name as user_name',
            'users.email as user_email',
        ];

        $raw = DB::table($table)
            ->join('users', 'users.id', '=', "{$table}.user_id")
            ->where("{$table}.last_activity", '>=', $cutoff)
            ->orderByDesc("{$table}.last_activity")
            ->select($select)
            ->get();

        $historyRaw = DB::table($table)
            ->join('users', 'users.id', '=', "{$table}.user_id")
            ->where("{$table}.last_activity", '<', $cutoff)
            ->orderByDesc("{$table}.last_activity")
            ->limit(self::HISTORY_LIMIT)
            ->select($select)
            ->get();

        $currentId = $request->session()->getId();

        $rows = $this->mapSessionRows($raw, $tz, $userAgentSummary, $currentId);
        $historyRows = $this->mapSessionRows($historyRaw, $tz, $userAgentSummary, $currentId);

        $collect = collect($rows);

        return Inertia::render('admin/active-sessions', [
            'sessions_unavailable' => false,
            'sessions_unavailable_reason' => null,
            'timezone' => $tz,
            'session_lifetime_minutes' => $lifetimeMin,
            'rows' => $rows,
            'rollup' => [
                'by_browser' => $collect->groupBy('browser')->map->count()->sortDesc()->all(),
                'by_os' => $collect->groupBy('os')->map->count()->sortDesc()->all(),
                'by_display_mode' => $collect->groupBy(fn ($r) => $r['display_mode'] ?? 'unknown')->map->count()->sortDesc()->all(),
            ],
            'current_session_id' => $currentId,
            'total' => count($rows),
            'history_rows' => $historyRows,
            'history_total' => count($historyRows),
            'history_limit' => self::HISTORY_LIMIT,
        ]);
    }

    /**
     * @param  Collection<int, object>  $raw
     * @return list<array<string, mixed>>
     */
    private function mapSessionRows($raw, string $tz, UserAgentSummary $userAgentSummary, string $currentId): array
    {
        $rows = [];
        foreach ($raw as $row) {
            $ua = $userAgentSummary->summarize($row->user_agent);
            $lastAt = CarbonImmutable::createFromTimestampUTC((int) $row->last_activity)->timezone($tz);

            $displayMode = $row->client_display_mode;
            if (! is_string($displayMode) || $displayMode === '') {
                $displayMode = null;
            }

            $clientPf = $row->client_platform;
            $platform = is_string($clientPf) && $clientPf !== '' ? $clientPf : $ua['os'];

            $rows[] = [
                'session_id' => (string) $row->session_id,
                'user_id' => (int) $row->user_id,
                'user_name' => (string) $row->user_name,
                'user_email' => (string) $row->user_email,
                'ip_address' => $row->ip_address !== null ? (string) $row->ip_address : null,
                'browser' => $ua['browser'],
                'os' => $ua['os'],
                'platform' => $platform,
                'display_mode' => $displayMode,
                'is_installed_web_app' => $displayMode === 'standalone' || $displayMode === 'minimal-ui',
                'last_activity_at' => $lastAt->toIso8601String(),
                'last_activity_human' => $lastAt->diffForHumans(),
                'is_current' => (string) $row->session_id === $currentId,
            ];
        }

        return $rows;
    }
}
