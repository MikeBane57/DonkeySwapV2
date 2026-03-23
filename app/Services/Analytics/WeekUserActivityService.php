<?php

namespace App\Services\Analytics;

use App\Models\LookingForWorkPost;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class WeekUserActivityService
{
    private const RESOLVED_SWAP_STATUSES = ['accepted', 'closed'];

    private const RESOLVED_LFW_STATUSES = ['accepted', 'closed'];

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    public function utcBoundsForLocalWeek(CarbonImmutable $weekStartLocal, CarbonImmutable $weekEndLocal): array
    {
        $startUtc = $weekStartLocal->copy()->startOfDay()->utc();
        $endUtc = $weekEndLocal->copy()->endOfDay()->utc();

        return [$startUtc, $endUtc];
    }

    /**
     * @return list<array{rank: int, user_id: int, name: string, email: string, employee_id: string|null, swap_posts: int, swap_offers: int, lfw_posts: int, activity_total: int}>
     */
    public function leaderboard(CarbonInterface $startUtc, CarbonInterface $endUtc, int $limit = 15): array
    {
        $swapByUser = SwapPost::query()
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->selectRaw('user_id, COUNT(*) as c')
            ->groupBy('user_id')
            ->pluck('c', 'user_id');

        $offersByUser = SwapOffer::query()
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->selectRaw('offered_by_user_id as user_id, COUNT(*) as c')
            ->groupBy('offered_by_user_id')
            ->pluck('c', 'user_id');

        $lfwByUser = LookingForWorkPost::query()
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->selectRaw('user_id, COUNT(*) as c')
            ->groupBy('user_id')
            ->pluck('c', 'user_id');

        $ids = collect([$swapByUser->keys(), $offersByUser->keys(), $lfwByUser->keys()])
            ->flatten()
            ->unique()
            ->filter()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $users = User::query()->whereIn('id', $ids)->get(['id', 'name', 'email', 'employee_id'])->keyBy('id');

        $rows = [];
        foreach ($ids as $uid) {
            $uid = (int) $uid;
            $sp = (int) ($swapByUser[$uid] ?? 0);
            $of = (int) ($offersByUser[$uid] ?? 0);
            $lf = (int) ($lfwByUser[$uid] ?? 0);
            $u = $users->get($uid);
            if (! $u) {
                continue;
            }
            $rows[] = [
                'user_id' => $uid,
                'name' => $u->name,
                'email' => $u->email,
                'employee_id' => $u->employee_id,
                'swap_posts' => $sp,
                'swap_offers' => $of,
                'lfw_posts' => $lf,
                'activity_total' => $sp + $of + $lf,
            ];
        }

        usort($rows, fn ($a, $b) => $b['activity_total'] <=> $a['activity_total']);

        $rows = array_slice($rows, 0, $limit);

        $out = [];
        $rank = 1;
        foreach ($rows as $r) {
            $r['rank'] = $rank++;
            $out[] = $r;
        }

        return $out;
    }

    /**
     * @return array{
     *     user: array{id: int, name: string, email: string, employee_id: string|null, role: string|null},
     *     swap_posts_created: int,
     *     swap_offers: int,
     *     lfw_posts_created: int,
     *     swap_posts_resolved: int,
     *     lfw_posts_resolved: int
     * }|null
     */
    public function userWeekBreakdown(int $userId, CarbonInterface $startUtc, CarbonInterface $endUtc): ?array
    {
        $user = User::query()->find($userId);
        if (! $user) {
            return null;
        }

        $swapPosts = SwapPost::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->count();

        $swapOffers = SwapOffer::query()
            ->where('offered_by_user_id', $userId)
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->count();

        $lfwPosts = LookingForWorkPost::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->count();

        $swapResolved = SwapPost::query()
            ->where('user_id', $userId)
            ->whereIn('status', self::RESOLVED_SWAP_STATUSES)
            ->whereBetween('updated_at', [$startUtc, $endUtc])
            ->count();

        $lfwResolved = LookingForWorkPost::query()
            ->where('user_id', $userId)
            ->whereIn('status', self::RESOLVED_LFW_STATUSES)
            ->whereBetween('updated_at', [$startUtc, $endUtc])
            ->count();

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'employee_id' => $user->employee_id,
                'role' => $user->role ?? null,
            ],
            'swap_posts_created' => $swapPosts,
            'swap_offers' => $swapOffers,
            'lfw_posts_created' => $lfwPosts,
            'swap_posts_resolved' => $swapResolved,
            'lfw_posts_resolved' => $lfwResolved,
        ];
    }
}
