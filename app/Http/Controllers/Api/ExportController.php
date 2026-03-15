<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ExportController extends Controller
{
    /**
     * Generate ICS file from current user's shifts. No OAuth, download only.
     */
    public function ics(Request $request): Response
    {
        $user = $request->user();
        $shifts = Shift::where('user_id', $user->id)
            ->orderBy('start_time_utc')
            ->get();

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Donkey Swap//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
        ];

        foreach ($shifts as $shift) {
            $start = $shift->start_time_utc->format('Ymd\THis\Z');
            $end = $shift->end_time_utc->format('Ymd\THis\Z');
            $summary = 'Shift: ' . $shift->position_name . ($shift->workgroup ? ' (' . $shift->workgroup->name . ')' : '');
            $lines[] = 'BEGIN:VEVENT';
            $lines[] = 'UID:shift-' . $shift->id . '@donkey-swap';
            $lines[] = 'DTSTAMP:' . now()->utc()->format('Ymd\THis\Z');
            $lines[] = 'DTSTART:' . $start;
            $lines[] = 'DTEND:' . $end;
            $lines[] = 'SUMMARY:' . $this->escapeIcsText($summary);
            $lines[] = 'END:VEVENT';
        }

        $lines[] = 'END:VCALENDAR';
        $body = implode("\r\n", $lines);

        return response($body, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="shifts.ics"',
        ]);
    }

    private function escapeIcsText(string $s): string
    {
        return str_replace(["\r", "\n", '\\', ';', ','], ['', '\\n', '\\\\', '\\;', '\\,'], $s);
    }
}
