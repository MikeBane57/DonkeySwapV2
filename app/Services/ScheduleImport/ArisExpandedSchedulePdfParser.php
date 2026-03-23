<?php

namespace App\Services\ScheduleImport;

use Smalot\PdfParser\Document;
use Smalot\PdfParser\Page;
use Smalot\PdfParser\Parser;

/**
 * Parses ARIS "Expanded schedule" PDF exports.
 *
 * Uses text positions (getDataTm) to build a row/column grid, then extracts
 * employee blocks (variable rows per person) and shift cells per date.
 * Returns the same shape as ArisExpandedScheduleCsvParser for downstream use.
 */
class ArisExpandedSchedulePdfParser
{
    private const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /**
     * @param  bool  $withDiagnostics  When true, add 'diagnostics' key with per-page grid/date/blocks counts.
     * @return array{rows: array<int, array<string, mixed>>, past_count: int, report_generated_at: string|null, diagnostics?: array<int, array{grid_rows: int, date_columns: int, blocks: int, grid_sample?: array<int, array<int, string>>}>}
     */
    public function parse(string $pdfContents, bool $withDiagnostics = false): array
    {
        if (strlen($pdfContents) < 100) {
            return ['rows' => [], 'past_count' => 0, 'report_generated_at' => null];
        }

        try {
            $parser = new Parser;
            $pdf = $parser->parseContent($pdfContents);
        } catch (\Throwable $e) {
            return ['rows' => [], 'past_count' => 0, 'report_generated_at' => null];
        }

        $pages = $pdf->getPages();
        if (count($pages) === 0) {
            return ['rows' => [], 'past_count' => 0, 'report_generated_at' => null];
        }

        $reportGeneratedAt = $this->extractReportGeneratedAt($pdf);

        $tz = new \DateTimeZone('America/Chicago');
        $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');
        $year = (int) (new \DateTimeImmutable('now', $tz))->format('Y');
        $out = [];
        $pastCount = 0;
        $diagnostics = [];

        foreach ($pages as $pageIndex => $page) {
            $grid = $this->buildGridFromPage($page);
            $dateColumns = $this->findDateColumns($grid, $year, $monthStart);
            $employeeBlocks = $this->findEmployeeBlocks($grid);

            if ($withDiagnostics) {
                $gridSample = array_slice($grid, 0, 20);
                $gridSample = array_map(fn ($r) => array_slice($r, 0, 12), $gridSample);
                $diagnostics[] = [
                    'grid_rows' => count($grid),
                    'date_columns' => count($dateColumns),
                    'blocks' => count($employeeBlocks),
                    'grid_sample' => $gridSample,
                ];
            }

            if (count($grid) < 4) {
                continue;
            }
            if (count($dateColumns) === 0) {
                continue;
            }
            foreach ($employeeBlocks as $block) {
                $employeeId = $block['employee_id'];
                $employeeName = $block['employee_name'];
                $quals = $block['qualifications'];
                $rows = $block['rows'];

                foreach ($dateColumns as $colIndex => $dateStr) {
                    $pairs = $this->collectShiftCellsForColumn($rows, $colIndex);
                    foreach ($pairs as [$timeCode, $deskCode]) {
                        if ($timeCode === '' && $deskCode === '') {
                            continue;
                        }
                        if (strcasecmp($timeCode, 'OFF') === 0 || strcasecmp($deskCode, 'OFF') === 0) {
                            continue;
                        }
                        if (! $this->isValidTimeCode($timeCode) || ! $this->isValidDeskCode($deskCode)) {
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
            }
        }

        $result = ['rows' => $out, 'past_count' => $pastCount, 'report_generated_at' => $reportGeneratedAt];
        if ($withDiagnostics) {
            $result['diagnostics'] = $diagnostics;
        }

        return $result;
    }

    /**
     * Try to extract report created/generated date and time from PDF text for "most recent report" display.
     */
    private function extractReportGeneratedAt(Document $pdf): ?string
    {
        try {
            $text = $pdf->getText();
            if ($text === '') {
                return null;
            }
            if (preg_match('/(?:Report version|Created|Generated|Run date|Printed|Report date|Extract date)[\s\S]{0,30}(\d{8})\b/i', $text, $m)) {
                $yyyymmdd = $m[1];
                if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $yyyymmdd, $d)) {
                    return sprintf('%04d-%02d-%02dT00:00:00', (int) $d[1], (int) $d[2], (int) $d[3]);
                }
            }
            if (preg_match('/(?:Report version|Created|Generated|Run date|Printed|Report date|Extract date)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?)/i', $text, $m)) {
                $dateStr = trim($m[1]);
                $parsed = \DateTimeImmutable::createFromFormat('m/d/Y g:i A', $dateStr)
                    ?: \DateTimeImmutable::createFromFormat('m-d-Y H:i', $dateStr)
                    ?: \DateTimeImmutable::createFromFormat('d-m-y', $dateStr)
                    ?: \DateTimeImmutable::createFromFormat('d-m-Y', $dateStr)
                    ?: \DateTimeImmutable::createFromFormat('Y-m-d', $dateStr)
                    ?: \DateTimeImmutable::createFromFormat('m/d/y', $dateStr);
                if ($parsed) {
                    return $parsed->format('Y-m-d\TH:i:s');
                }
            }
            if (preg_match('/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/', $text, $m)) {
                return sprintf('%04d-%02d-%02dT%02d:%02d:00', (int) $m[1], (int) $m[2], (int) $m[3], (int) $m[4], (int) $m[5]);
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
    }

    /**
     * Build a 2D grid: list of rows, each row is list of cell strings (by column index).
     * Uses getDataTm() and clusters by Y then X.
     *
     * @return array<int, array<int, string>>
     */
    private function buildGridFromPage(Page $page): array
    {
        $data = $page->getDataTm();
        if (! is_array($data)) {
            return [];
        }

        $points = [];
        foreach ($data as $item) {
            if (! is_array($item) || count($item) < 2) {
                continue;
            }
            $tm = $item[0];
            $text = isset($item[1]) ? trim((string) $item[1]) : '';
            if ($text === '') {
                continue;
            }
            $x = isset($tm[4]) ? (float) $tm[4] : 0;
            $y = isset($tm[5]) ? (float) $tm[5] : 0;
            $points[] = ['x' => $x, 'y' => $y, 'text' => $text];
        }

        if (count($points) === 0) {
            return [];
        }

        $yTolerance = 3.0;
        $xTolerance = 8.0;

        $yGroups = $this->clusterBy($points, 'y', $yTolerance);
        $rows = [];
        $yKeys = array_keys($yGroups);
        rsort($yKeys, SORT_NUMERIC);

        foreach ($yKeys as $yVal) {
            $rowPoints = $yGroups[$yVal];
            $xGroups = $this->clusterBy($rowPoints, 'x', $xTolerance);
            $xKeys = array_keys($xGroups);
            sort($xKeys, SORT_NUMERIC);
            $rowCells = [];
            foreach ($xKeys as $xVal) {
                $cellTexts = array_map(fn ($p) => $p['text'], $xGroups[$xVal]);
                $rowCells[] = implode(' ', $cellTexts);
            }
            $rows[] = $rowCells;
        }

        return $rows;
    }

    /**
     * @param  array<int, array<string, mixed>>  $points
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function clusterBy(array $points, string $axis, float $tolerance): array
    {
        $groups = [];
        foreach ($points as $p) {
            $v = (float) ($p[$axis] ?? 0);
            $groupKey = null;
            foreach (array_keys($groups) as $existingStr) {
                $existing = (float) $existingStr;
                if (abs($v - $existing) <= $tolerance) {
                    $groupKey = $existingStr;
                    break;
                }
            }
            if ($groupKey === null) {
                $groupKey = sprintf('%.4f', round($v, 4));
            }
            $groups[$groupKey] = $groups[$groupKey] ?? [];
            $groups[$groupKey][] = $p;
        }

        return $groups;
    }

    /**
     * Find which column indices correspond to dates (from header rows).
     * Supports: separate month row + day row; single row with "Mar 17" cells; day cells with "17 Tue" (DOW suffix).
     *
     * @param  array<int, array<int, string>>  $grid
     * @return array<int, string> columnIndex => YYYY-MM-DD
     */
    private function findDateColumns(array $grid, int $year, string $monthStart): array
    {
        $dateColumns = $this->findDateColumnsFromCombinedRow($grid, $year, $monthStart);
        if (count($dateColumns) > 0) {
            return $dateColumns;
        }

        $dateColumns = [];
        $monthRow = null;
        $dayRow = null;

        foreach ($grid as $row) {
            $rowStr = implode(' ', $row);
            if (stripos($rowStr, 'Name (ID)') !== false || stripos($rowStr, 'Report version') !== false) {
                continue;
            }
            if (stripos($rowStr, 'Expanded schedule') !== false || stripos($rowStr, 'worker type') !== false
                || stripos($rowStr, 'qualification') !== false || stripos($rowStr, 'worker [') !== false
                || (stripos($rowStr, 'from') !== false && stripos($rowStr, 'to') !== false && strlen($rowStr) > 40)) {
                continue;
            }
            if (preg_match('/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/', $rowStr)) {
                $monthAbbrCount = preg_match_all('/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/', $rowStr);
                if ($monthAbbrCount >= 1 && ! preg_match('/\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}/i', $rowStr)) {
                    $monthRow = $row;
                }
            }
            if ($monthRow !== null && $dayRow === null) {
                $dayLikeCount = 0;
                foreach ($row as $cell) {
                    if ($this->cellHasDayNumber($cell)) {
                        $dayLikeCount++;
                    }
                }
                if ($dayLikeCount >= 3 && stripos($rowStr, 'Expanded schedule') === false && stripos($rowStr, 'worker type') === false) {
                    $dayRow = $row;
                    break;
                }
            }
        }

        if ($monthRow !== null && $dayRow !== null) {
            $currentMonth = null;
            $monthNum = null;
            for ($c = 0; $c < max(count($monthRow), count($dayRow)); $c++) {
                $m = trim($monthRow[$c] ?? '');
                if ($m !== '' && preg_match('/^[A-Za-z]{3}$/', $m)) {
                    $currentMonth = $m;
                    $monthNum = $this->monthNum($currentMonth);
                }
                $dayCell = trim($dayRow[$c] ?? '');
                $dayNum = $this->extractDayFromCell($dayCell);
                if ($currentMonth && $monthNum !== null && $dayNum !== null) {
                    $candidate = sprintf('%04d-%02d-%02d', $year, $monthNum, $dayNum);
                    if ($candidate < $monthStart) {
                        $candidate = sprintf('%04d-%02d-%02d', $year + 1, $monthNum, $dayNum);
                    }
                    $dateColumns[$c] = $candidate;
                }
            }
        }

        if (count($dateColumns) > 0) {
            return $dateColumns;
        }

        return $this->findDateColumnsFallback($grid, $year, $monthStart);
    }

    /**
     * One row with cells like "Mar 17", "Mar 18" or "Apr 01" (month + day in same cell).
     *
     * @param  array<int, array<int, string>>  $grid
     * @return array<int, string>
     */
    private function findDateColumnsFromCombinedRow(array $grid, int $year, string $monthStart): array
    {
        foreach ($grid as $row) {
            $rowStr = implode(' ', $row);
            if (stripos($rowStr, 'Name (ID)') !== false || stripos($rowStr, 'Report version') !== false) {
                continue;
            }
            if (stripos($rowStr, 'Expanded schedule') !== false || stripos($rowStr, 'worker type') !== false) {
                continue;
            }
            $dateColumns = [];
            $monthNum = null;
            foreach ($row as $c => $cell) {
                $cell = trim((string) $cell);
                if (preg_match('/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})\b/i', $cell, $m)) {
                    $mn = $this->monthNum($m[1]);
                    if ($mn !== null) {
                        $monthNum = $mn;
                    }
                    $dayNum = (int) $m[2];
                    if ($dayNum >= 1 && $dayNum <= 31 && $monthNum !== null) {
                        $candidate = sprintf('%04d-%02d-%02d', $year, $monthNum, $dayNum);
                        if ($candidate < $monthStart) {
                            $candidate = sprintf('%04d-%02d-%02d', $year + 1, $monthNum, $dayNum);
                        }
                        $dateColumns[$c] = $candidate;
                    }
                }
            }
            if (count($dateColumns) >= 5) {
                return $dateColumns;
            }
        }

        return [];
    }

    private function cellHasDayNumber(string $cell): bool
    {
        $cell = trim($cell);
        if ($cell === '') {
            return false;
        }
        if (preg_match('/^\d{1,2}$/', $cell)) {
            $n = (int) $cell;

            return $n >= 1 && $n <= 31;
        }
        if (preg_match('/^(\d{1,2})\b/', $cell, $m)) {
            $n = (int) $m[1];

            return $n >= 1 && $n <= 31;
        }

        return false;
    }

    private function extractDayFromCell(string $cell): ?int
    {
        $cell = trim($cell);
        if ($cell === '') {
            return null;
        }
        if (preg_match('/^\d{1,2}$/', $cell)) {
            $n = (int) $cell;

            return ($n >= 1 && $n <= 31) ? $n : null;
        }
        if (preg_match('/^(\d{1,2})\b/', $cell, $m)) {
            $n = (int) $m[1];

            return ($n >= 1 && $n <= 31) ? $n : null;
        }

        return null;
    }

    /**
     * Fallback: find a row that looks like day numbers (5+ cells with 1-31). Use row above for month if it has month abbrs, else current month.
     * Day cells may be "17" or "17 Tue" (DOW suffix).
     *
     * @param  array<int, array<int, string>>  $grid
     * @return array<int, string>
     */
    private function findDateColumnsFallback(array $grid, int $year, string $monthStart): array
    {
        $defaultMonth = (int) (new \DateTimeImmutable('now', new \DateTimeZone('America/Chicago')))->format('n');
        $dateColumns = [];

        foreach ($grid as $i => $row) {
            $dayCount = 0;
            $candidates = [];
            foreach ($row as $c => $cell) {
                $dayNum = $this->extractDayFromCell((string) $cell);
                if ($dayNum !== null) {
                    $dayCount++;
                    $candidates[$c] = $dayNum;
                }
            }
            if ($dayCount >= 5) {
                $monthRow = $i > 0 ? $grid[$i - 1] : [];
                $monthNum = $defaultMonth;
                foreach ($candidates as $c => $dayNum) {
                    $m = trim($monthRow[$c] ?? '');
                    if ($m !== '' && preg_match('/^[A-Za-z]{3}$/', $m)) {
                        $mn = $this->monthNum($m);
                        if ($mn !== null) {
                            $monthNum = $mn;
                        }
                    }
                    $candidate = sprintf('%04d-%02d-%02d', $year, $monthNum, $dayNum);
                    if ($candidate < $monthStart) {
                        $candidate = sprintf('%04d-%02d-%02d', $year + 1, $monthNum, $dayNum);
                    }
                    $dateColumns[$c] = $candidate;
                }

                return $dateColumns;
            }
        }

        return [];
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

    /**
     * Find blocks of consecutive rows that belong to the same employee.
     * First row in block has (employee_id); following rows are continuation until next (id) or header.
     *
     * @param  array<int, array<int, string>>  $grid
     * @return array<int, array{employee_id: string, employee_name: string, qualifications: array<int, string>, rows: array<int, array<int, string>>}>
     */
    private function findEmployeeBlocks(array $grid): array
    {
        $blocks = [];
        $currentId = null;
        $currentName = '';
        $currentQuals = [];
        $currentRows = [];
        $skipHeader = true;

        foreach ($grid as $row) {
            $firstCell = $row[0] ?? '';
            $fullRow = implode(' ', $row);

            if (stripos($fullRow, 'Name (ID) Qualification') !== false || stripos($fullRow, 'Report version') !== false) {
                if ($currentId !== null) {
                    $blocks[] = [
                        'employee_id' => $currentId,
                        'employee_name' => $currentName,
                        'qualifications' => $currentQuals,
                        'rows' => $currentRows,
                    ];
                    $currentId = null;
                    $currentRows = [];
                }
                $skipHeader = true;

                continue;
            }

            if (preg_match('/\((\d+)\)/', $fullRow, $m)) {
                if ($currentId !== null && $currentId !== $m[1]) {
                    $blocks[] = [
                        'employee_id' => $currentId,
                        'employee_name' => $currentName,
                        'qualifications' => $currentQuals,
                        'rows' => $currentRows,
                    ];
                    $currentRows = [];
                }
                $currentId = $m[1];
                $currentName = trim(preg_replace('/\s+/', ' ', preg_replace('/\(\d+\)/', '', $fullRow) ?? ''));
                $currentQuals = $this->parseQualsFromNameCol($fullRow);
                $currentRows[] = $row;
                $skipHeader = false;

                continue;
            }

            if ($skipHeader) {
                continue;
            }

            if ($currentId !== null) {
                $currentRows[] = $row;
            }
        }

        if ($currentId !== null) {
            $blocks[] = [
                'employee_id' => $currentId,
                'employee_name' => $currentName,
                'qualifications' => $currentQuals,
                'rows' => $currentRows,
            ];
        }

        return $blocks;
    }

    /** @return array<int, string> */
    private function parseQualsFromNameCol(string $nameCol): array
    {
        $s = preg_replace('/^.*\\)\\s*/', '', $nameCol) ?? '';
        $parts = array_map('trim', explode(',', $s));

        return array_values(array_filter($parts, fn ($p) => $p !== ''));
    }

    private function isValidTimeCode(string $s): bool
    {
        $s = trim($s);
        if ($s === '') {
            return false;
        }
        if (strlen($s) > 4) {
            return false;
        }
        if (str_contains($s, '(') || str_contains($s, ')') || str_contains($s, ',')) {
            return false;
        }

        return (bool) preg_match('/^\d{1,2}$/', $s);
    }

    private function isValidDeskCode(string $s): bool
    {
        $s = trim($s);
        if ($s === '') {
            return false;
        }
        if (strlen($s) > 12) {
            return false;
        }
        if (str_contains($s, '(') || str_contains($s, ')') || str_contains($s, ',')) {
            return false;
        }

        return (bool) preg_match('/^[A-Za-z0-9\-]+$/i', $s);
    }

    /**
     * For one date column, collect all (time_code, desk_code) pairs from the block rows.
     * PDF may have one cell "14 S1" or two cells "14" and "S1" for that column.
     *
     * @param  array<int, array<int, string>>  $rows
     * @return array<int, array{0: string, 1: string}>
     */
    private function collectShiftCellsForColumn(array $rows, int $colIndex): array
    {
        $pairs = [];
        foreach ($rows as $row) {
            $cell = trim($row[$colIndex] ?? '');
            if ($cell === '' || strcasecmp($cell, 'OFF') === 0) {
                continue;
            }
            $next = trim($row[$colIndex + 1] ?? '');
            if ($next !== '' && strcasecmp($next, 'OFF') !== 0) {
                $pairs[] = [$cell, $next];

                continue;
            }
            if (preg_match('/^(\d{1,2})\s+([A-Z0-9]+)$/i', $cell, $m)) {
                $pairs[] = [$m[1], $m[2]];
            } elseif (preg_match('/^([A-Z0-9]+)$/i', $cell)) {
                $pairs[] = ['', $cell];
            }
        }

        return $pairs;
    }
}
