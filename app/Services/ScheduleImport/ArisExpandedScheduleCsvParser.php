<?php

namespace App\Services\ScheduleImport;

/**
 * Parses ARIS "Expanded schedule" CSV exports.
 *
 * These files are a calendar matrix: repeated month header blocks followed by one row per employee.
 * Each day is represented as a pair: time_code, desk_code (or OFF/blank). Some employees have
 * multiple data rows: the first row has name/ID, following rows with empty name are continuation
 * rows (doubles, or leave lines). We read all such rows with column offsets 0, 1, 2, ... so each
 * continuation row supplies an additional (time, desk) pair per day. Leave codes (VAC, SICK, etc.)
 * are emitted and filtered later by the service. The file may have multiple header blocks (same
 * header row repeated); we treat each as a new month block and scan all columns for the header.
 */
class ArisExpandedScheduleCsvParser
{
    /**
     * @return array{rows: array<int, array<string, mixed>>, past_count: int}
     */
    public function parse(string $csvContents): array
    {
        $rows = $this->readCsv($csvContents);
        if (count($rows) < 4) {
            return ['rows' => [], 'past_count' => 0];
        }

        $out = [];
        $pastCount = 0;
        $tz = new \DateTimeZone('America/Chicago');
        $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');
        $i = 0;
        while ($i < count($rows)) {
            // Find header trio: "Name (ID) Qualification" can be in any column (file has embedded headers).
            if (! $this->rowContainsHeader($rows[$i] ?? [], 'Name (ID) Qualification')) {
                $i++;

                continue;
            }

            $monthRow = $rows[$i] ?? [];
            $dayRow = $rows[$i + 1] ?? [];
            $dowRow = $rows[$i + 2] ?? [];
            $i += 3;

            $datesByCol = $this->buildDateMap($monthRow, $dayRow, $dowRow);
            if (count($datesByCol) === 0) {
                continue;
            }

            // Consume employee rows until next header or end.
            // First row has name/ID; following rows with empty name are continuation rows (doubles, leave lines, etc.).
            while ($i < count($rows)) {
                $r = $rows[$i];
                if ($this->rowContainsHeader($r, 'Name (ID) Qualification')) {
                    break;
                }
                if ($this->rowContainsHeader($r, 'Report version')) {
                    $i++;

                    continue;
                }
                $first = (string) ($r[0] ?? '');
                $nameCol = (string) (($r[1] ?? '') !== '' ? $r[1] : $r[0]);

                $employeeId = null;
                $employeeName = '';
                $quals = [];

                if (trim($nameCol) !== '' && preg_match('/\((\d+)\)/', $nameCol, $m)) {
                    $employeeId = $m[1];
                    $employeeName = trim(preg_replace('/\s+/', ' ', preg_replace('/\(\d+\)/', '', $nameCol) ?? ''));
                    $quals = $this->parseQualsFromNameCol($nameCol);
                }

                // Collect this row plus any consecutive continuation rows (empty name cells).
                $rowsToRead = [['row' => $r]];
                $j = $i + 1;
                while ($j < count($rows) && $employeeId !== null) {
                    $nextRow = $rows[$j];
                    if ($this->rowContainsHeader($nextRow, 'Name (ID) Qualification') || $this->rowContainsHeader($nextRow, 'Report version')) {
                        break;
                    }
                    $nextFirst = (string) ($nextRow[0] ?? '');
                    $nextNameCol = (string) (($nextRow[1] ?? '') !== '' ? $nextRow[1] : $nextRow[0]);
                    if (trim($nextNameCol) !== '' || trim($nextFirst) !== '') {
                        break;
                    }
                    $rowsToRead[] = ['row' => $nextRow];
                    $j++;
                }

                if ($employeeId !== null) {
                    // Each row (main + continuation) is another line in the same calendar grid: same column indices.
                    foreach ($rowsToRead as $entry) {
                        $dataRow = $entry['row'];
                        foreach ($datesByCol as $col => $dateStr) {
                            $timeCode = isset($dataRow[$col]) ? trim((string) $dataRow[$col]) : '';
                            $deskCode = isset($dataRow[$col + 1]) ? trim((string) $dataRow[$col + 1]) : '';

                            if ($timeCode === '' && $deskCode === '') {
                                continue;
                            }
                            if (strcasecmp($timeCode, 'OFF') === 0 || strcasecmp($deskCode, 'OFF') === 0) {
                                continue;
                            }
                            // Skip cells where time_code is not parseable as a time (e.g. leave codes L, S, V, ^; or DHD, EOF, etc.).
                            if (! $this->looksLikeTimeCode($timeCode)) {
                                continue;
                            }
                            $isPast = $dateStr < $monthStart;
                            if ($isPast) {
                                $pastCount++;
                            }

                            $out[] = [
                                'employee_id' => $employeeId,
                                'employee_name' => $employeeName,
                                'qualifications' => $quals,
                                'shift_date' => $dateStr,
                                'time_code' => $timeCode,
                                'desk_code' => $deskCode,
                                '_past' => $isPast,
                            ];
                        }
                    }

                    $i = $j;
                } else {
                    $i++;
                }
            }
        }

        return ['rows' => $out, 'past_count' => $pastCount];
    }

    /** @return array<int, array<int, string>> */
    private function readCsv(string $contents): array
    {
        $lines = preg_split('/\\r\\n|\\n|\\r/', $contents) ?: [];
        $rows = [];
        foreach ($lines as $line) {
            if ($line === '') {
                continue;
            }
            // Explicit escape parameter to avoid PHP 8.4 deprecation warnings.
            $rows[] = str_getcsv($line, ',', '"', '\\');
        }

        return $rows;
    }

    /**
     * Returns map of columnIndex => YYYY-MM-DD local date.
     * Only includes dates in the current month and beyond (America/Chicago).
     * Year is chosen so that each (month, day) falls on or after the first day of the current month.
     *
     * The CSV is weird: month names repeat with empty columns, and each day occupies two columns.
     * We treat the first of each pair as the time_code column.
     *
     * @return array<int, string>
     */
    private function buildDateMap(array $monthRow, array $dayRow, array $dowRow): array
    {
        $tz = new \DateTimeZone('America/Chicago');
        $now = new \DateTimeImmutable('now', $tz);
        $monthStart = $now->format('Y-m-01');
        $year = (int) $now->format('Y');

        $datesByCol = [];
        $currentMonth = null;
        for ($c = 0; $c < count($monthRow); $c++) {
            $m = trim((string) ($monthRow[$c] ?? ''));
            if ($m !== '' && preg_match('/^[A-Za-z]{3}$/', $m)) {
                $currentMonth = $m;
            }

            $day = trim((string) ($dayRow[$c] ?? ''));
            if ($currentMonth && $day !== '' && preg_match('/^\\d{1,2}$/', $day)) {
                $monthNum = $this->monthNum($currentMonth);
                if ($monthNum) {
                    $candidate = sprintf('%04d-%02d-%02d', $year, $monthNum, (int) $day);
                    if ($candidate < $monthStart) {
                        $candidate = sprintf('%04d-%02d-%02d', $year + 1, $monthNum, (int) $day);
                    }
                    $datesByCol[$c] = $candidate;
                }
            }
        }

        return $datesByCol;
    }

    /** Check if any cell in the row contains the given substring (case-insensitive). Handles headers in any column. */
    private function rowContainsHeader(array $row, string $substring): bool
    {
        foreach ($row as $cell) {
            if (stripos((string) $cell, $substring) !== false) {
                return true;
            }
        }

        return false;
    }

    /** True if the string looks like a time we can parse (hour or HHMM). Skips leave/annotation codes like L, S, V, DHD, EOF. */
    private function looksLikeTimeCode(string $timeCode): bool
    {
        $t = trim($timeCode);
        if ($t === '') {
            return false;
        }

        return preg_match('/^\d{1,2}$/', $t) === 1
            || preg_match('/^\d{1,2}:\d{2}/', $t) === 1
            || preg_match('/^\d{3}$/', $t) === 1
            || preg_match('/^\d{4}$/', $t) === 1;
    }

    private function monthNum(string $abbr): ?int
    {
        $map = [
            'Jan' => 1, 'Feb' => 2, 'Mar' => 3, 'Apr' => 4, 'May' => 5, 'Jun' => 6,
            'Jul' => 7, 'Aug' => 8, 'Sep' => 9, 'Oct' => 10, 'Nov' => 11, 'Dec' => 12,
        ];
        $abbr = ucfirst(strtolower($abbr));

        return $map[$abbr] ?? null;
    }

    /** @return array<int, string> */
    private function parseQualsFromNameCol(string $nameCol): array
    {
        // After the name/id, the rest of the string is comma-separated qualifications.
        // Example: "Bane, Michael  (99917) Asst, Junior Avail, MTRN, SOD, SSOD"
        $s = preg_replace('/^.*\\)\\s*/', '', $nameCol) ?? '';
        $parts = array_map('trim', explode(',', $s));
        $parts = array_values(array_filter($parts, fn ($p) => $p !== ''));

        return $parts;
    }
}
