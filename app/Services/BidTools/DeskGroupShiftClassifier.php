<?php

namespace App\Services\BidTools;

/**
 * Classifies bid lines into AM / PM / Mid shifts from desk group prefix.
 *
 * D* — day / AM (e.g. DG, DR, DS)
 * A* — afternoon / PM (e.g. AG, AR, AS)
 * M* — midnight (e.g. MG, MS, MID MIX)
 */
final class DeskGroupShiftClassifier
{
    public function shiftForDeskGroup(string $deskGroup): ?string
    {
        $group = strtoupper(trim($deskGroup));
        if ($group === '') {
            return null;
        }

        $letter = $group[0];

        return match ($letter) {
            'D' => 'am',
            'A' => 'pm',
            'M' => 'mid',
            default => null,
        };
    }
}
