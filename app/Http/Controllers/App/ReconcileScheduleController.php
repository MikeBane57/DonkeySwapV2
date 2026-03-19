<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\ScheduleReconciliation;
use App\Models\ScheduleReconciliationItem;
use App\Models\Shift;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReconcileScheduleController extends Controller
{
    public function index(): Response|RedirectResponse
    {
        $user = request()->user();
        $pending = ScheduleReconciliation::where('user_id', $user->id)
            ->where('status', 'pending')
            ->with('items')
            ->orderByDesc('created_at')
            ->first();

        if ($pending) {
            return redirect()->route('reconcile-schedule.show', $pending->id);
        }

        return Inertia::render('app/reconcile-schedule', [
            'reconciliation' => null,
            'message' => 'You have no pending schedule reconciliations.',
        ]);
    }

    public function show(ScheduleReconciliation $reconcile_schedule): Response|RedirectResponse
    {
        $user = request()->user();
        if ($reconcile_schedule->user_id !== $user->id) {
            abort(404);
        }
        if ($reconcile_schedule->status !== 'pending') {
            return redirect()->route('reconcile-schedule.index')->with('info', 'This reconciliation was already completed.');
        }

        $reconcile_schedule->load('items.shift');
        $items = $reconcile_schedule->items->map(fn ($i) => [
            'id' => $i->id,
            'type' => $i->type,
            'shift_id' => $i->shift_id,
            'snapshot' => $i->snapshot,
            'user_action' => $i->user_action,
            'reason' => $i->reason,
            'shift' => $i->shift ? [
                'id' => $i->shift->id,
                'position_name' => $i->shift->position_name,
                'desk_type' => $i->shift->desk_type,
                'start_time_utc' => $i->shift->start_time_utc?->toIso8601String(),
                'end_time_utc' => $i->shift->end_time_utc?->toIso8601String(),
            ] : null,
        ])->values()->all();

        return Inertia::render('app/reconcile-schedule', [
            'reconciliation' => [
                'id' => $reconcile_schedule->id,
                'created_at' => $reconcile_schedule->created_at?->toIso8601String(),
                'items' => $items,
            ],
            'message' => 'We have detected there has been an update to your workzone that may not be captured in this app. Please review the following discrepancies.',
        ]);
    }

    public function store(Request $request, ScheduleReconciliation $reconcile_schedule): RedirectResponse
    {
        $user = $request->user();
        if ($reconcile_schedule->user_id !== $user->id || $reconcile_schedule->status !== 'pending') {
            abort(404);
        }

        $actions = $request->input('actions', []);
        foreach ($reconcile_schedule->items as $item) {
            $key = (string) $item->id;
            $action = $actions[$key]['action'] ?? null;
            $reason = trim((string) ($actions[$key]['reason'] ?? ''));
            if ($item->type === 'added' && $action === 'rejected' && $reason === '') {
                return redirect()->back()->withErrors(['actions' => 'Please provide a reason when rejecting an added shift.']);
            }
            if ($item->type === 'removed' && $action === 'kept' && $reason === '') {
                return redirect()->back()->withErrors(['actions' => 'Please provide a reason when keeping a removed shift.']);
            }
        }
        foreach ($reconcile_schedule->items as $item) {
            $key = (string) $item->id;
            $action = $actions[$key]['action'] ?? null;
            $reason = $actions[$key]['reason'] ?? null;
            if (! $action) {
                continue;
            }
            $item->update(['user_action' => $action, 'reason' => $reason]);

            if ($item->type === 'added' && $action === 'rejected' && $item->shift_id) {
                $shift = Shift::find($item->shift_id);
                if ($shift && $shift->user_id === $user->id) {
                    $shift->swapPosts()->delete();
                    $shift->delete();
                }
            }
            if ($item->type === 'removed' && $action === 'kept' && is_array($item->snapshot)) {
                $snap = $item->snapshot;
                Shift::create([
                    'user_id' => $snap['user_id'],
                    'workgroup_id' => $snap['workgroup_id'],
                    'position_name' => $snap['position_name'] ?? '',
                    'desk_type' => $snap['desk_type'] ?? '',
                    'start_time_utc' => $snap['start_time_utc'],
                    'end_time_utc' => $snap['end_time_utc'] ?? null,
                    'regulatory' => $snap['regulatory'] ?? false,
                    'is_training' => $snap['is_training'] ?? false,
                ]);
            }
        }

        $reconcile_schedule->update(['status' => 'completed', 'completed_at' => now()]);

        \App\Models\AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->where('type', 'admin_message')
            ->get()
            ->each(function (\App\Models\AppNotification $n) use ($reconcile_schedule) {
                if (($n->data['reconciliation_id'] ?? null) == $reconcile_schedule->id) {
                    $n->update(['read_at' => now()]);
                }
            });

        return redirect()->route('reconcile-schedule.index')->with('success', 'Thank you. Your reconciliation has been saved.');
    }
}
