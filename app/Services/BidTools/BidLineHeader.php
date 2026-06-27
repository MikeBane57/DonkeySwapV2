<?php

namespace App\Services\BidTools;

use Carbon\CarbonImmutable;
use DateTime;

final class BidLineHeader
{
    public static function normalize(string $value): string
    {
        $value = preg_replace('/\x{00A0}/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);

        return $value;
    }

    public static function isLineNumColumn(string $value): bool
    {
        $normalized = self::normalize($value);
        if ($normalized === '') {
            return false;
        }

        foreach (['Line Num', 'Line Number', 'Line #', 'Line No', 'Line No.', 'LineNum'] as $label) {
            if (strcasecmp($normalized, $label) === 0) {
                return true;
            }
        }

        return preg_match('/^line\s*(?:num|number|no\.?|#)$/i', $normalized) === 1;
    }

    public static function parseDateHeader(string $label): ?string
    {
        $label = self::normalize($label);
        if ($label === '') {
            return null;
        }

        if (is_numeric($label)) {
            $serial = (float) $label;
            if ($serial >= 1 && $serial <= 60000) {
                $base = CarbonImmutable::create(1899, 12, 30);
                if ($base !== null) {
                    return $base->addDays((int) floor($serial))->format('Y-m-d');
                }
            }
        }

        foreach (['j-M-y', 'd-M-y', 'j-M-Y', 'd-M-Y', 'Y-m-d', 'm/d/Y', 'n/j/Y'] as $fmt) {
            $dt = DateTime::createFromFormat('!'.$fmt, $label);
            if ($dt instanceof DateTime) {
                return CarbonImmutable::parse($dt->format('Y-m-d'))->format('Y-m-d');
            }
        }

        return null;
    }

    /**
     * @param  list<list<string>>  $rows
     * @return array{0: int, 1: int, 2: int}|null
     */
    public static function findHeaderRow(array $rows, int $minDateColumns = 20): ?array
    {
        $limit = min(count($rows), 100);
        $best = null;
        $bestDateCount = -1;

        for ($i = 0; $i < $limit; $i++) {
            foreach ($rows[$i] as $col => $cell) {
                if (! self::isLineNumColumn((string) $cell)) {
                    continue;
                }

                $dateCount = self::countDateColumnsInRow($rows[$i], (int) $col);
                if ($dateCount >= $minDateColumns && $dateCount > $bestDateCount) {
                    $best = [$i, (int) $col, $dateCount];
                    $bestDateCount = $dateCount;
                }
            }
        }

        return $best;
    }

    /**
     * @param  list<list<string>>  $rows
     * @return array{0: int, 1: int}|null
     */
    public static function findInRows(array $rows): ?array
    {
        $found = self::findHeaderRow($rows);

        return $found === null ? null : [$found[0], $found[1]];
    }

    /**
     * @param  list<string>  $row
     */
    public static function countDateColumnsInRow(array $row, int $lineNumCol): int
    {
        $count = 0;
        $fixedEnd = $lineNumCol + 3;

        foreach ($row as $idx => $label) {
            if ($idx <= $fixedEnd) {
                continue;
            }

            $trim = self::normalize((string) $label);
            if (strcasecmp($trim, 'workdays') === 0) {
                continue;
            }

            if (self::parseDateHeader($trim) !== null) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @param  list<list<string>>  $rows
     */
    public static function preview(array $rows): string
    {
        $chunks = [];
        foreach (array_slice($rows, 0, 5) as $i => $row) {
            $cells = [];
            foreach (array_slice($row, 0, 8) as $cell) {
                $text = self::normalize((string) $cell);
                if ($text !== '') {
                    $cells[] = $text;
                }
            }
            if ($cells !== []) {
                $chunks[] = 'row '.($i + 1).': '.implode(' | ', $cells);
            }
        }

        return $chunks === [] ? '(no readable rows found)' : implode('; ', $chunks);
    }
}
