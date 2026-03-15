<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

class WorkgroupPositionRange extends Model
{
    protected $fillable = [
        'workgroup_id',
        'workgroup_desk_type_id',
        'range_spec',
        'parity',
        'sort_order',
    ];

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }

    public function deskType(): BelongsTo
    {
        return $this->belongsTo(WorkgroupDeskType::class, 'workgroup_desk_type_id');
    }

    /**
     * Expand this range to a list of position labels.
     *
     * @return array<int, string>
     */
    public function expandToLabels(): array
    {
        $spec = trim($this->range_spec);
        $parity = $this->parity;

        // Single value (e.g. "A", "Training")
        if (strpos($spec, '-') === false) {
            return $spec === '' ? [] : [$spec];
        }

        // Numeric range (e.g. "1-98", "100-130")
        if (preg_match('/^(\d+)-(\d+)$/', $spec, $m)) {
            $low = (int) $m[1];
            $high = (int) $m[2];
            if ($low > $high) {
                [$low, $high] = [$high, $low];
            }
            $out = [];
            for ($n = $low; $n <= $high; $n++) {
                if ($parity === 'even' && $n % 2 !== 0) {
                    continue;
                }
                if ($parity === 'odd' && $n % 2 === 0) {
                    continue;
                }
                $out[] = (string) $n;
            }
            return $out;
        }

        // Prefixed number range (e.g. "G1-G4", "S1-S6", "R1-R3")
        if (preg_match('/^([A-Za-z]+)(\d+)-([A-Za-z]+)(\d+)$/', $spec, $m)) {
            $prefix1 = $m[1];
            $num1 = (int) $m[2];
            $prefix2 = $m[3];
            $num2 = (int) $m[4];
            if ($prefix1 !== $prefix2) {
                return [$spec];
            }
            if ($num1 > $num2) {
                [$num1, $num2] = [$num2, $num1];
            }
            $out = [];
            for ($n = $num1; $n <= $num2; $n++) {
                $out[] = $prefix1 . $n;
            }
            return $out;
        }

        return [$spec];
    }

    /**
     * Expand this range to items with label, type, sublocation and shift_type for the Add Shift dropdown.
     *
     * @return array<int, array{label: string, type: string, sublocation_type: string|null, shift_type: string}>
     */
    public function expandToPositionItems(): array
    {
        $labels = $this->expandToLabels();
        $code = $this->deskType?->code ?? 'extra';
        $type = $code === 'extra' ? 'extra' : 'desk';
        $sublocation = in_array($code, ['regional', 'sector', 'nextday'], true) ? $code : null;

        return array_map(fn ($label) => [
            'label' => $label,
            'type' => $type,
            'sublocation_type' => $sublocation,
            'shift_type' => $code,
        ], $labels);
    }

    /**
     * Expand a collection of ranges to a flat list of position items (for dashboard/add-shift).
     *
     * @param  Collection<int, WorkgroupPositionRange>  $ranges
     * @return array<int, array{label: string, type: string, sublocation_type: string|null, shift_type: string}>
     */
    public static function expandRangesToPositions(Collection $ranges): array
    {
        $items = [];
        foreach ($ranges as $range) {
            foreach ($range->expandToPositionItems() as $item) {
                $items[] = $item;
            }
        }
        return $items;
    }
}
