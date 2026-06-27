<?php

namespace App\Services\BidTools;

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

    /**
     * @param  list<list<string>>  $rows
     * @return array{0: int, 1: int}|null
     */
    public static function findInRows(array $rows): ?array
    {
        $limit = min(count($rows), 75);
        for ($i = 0; $i < $limit; $i++) {
            foreach ($rows[$i] as $col => $cell) {
                if (self::isLineNumColumn((string) $cell)) {
                    return [$i, (int) $col];
                }
            }
        }

        return null;
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
