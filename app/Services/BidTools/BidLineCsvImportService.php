<?php

namespace App\Services\BidTools;

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

final class BidLineCsvImportService
{
    /**
     * @param  list<array{path: string, original_filename: string, source_label: ?string}>  $sources
     * @return array{import: BidImport, line_count: int, distinct_codes: list<string>}
     */
    public function importFromSources(array $sources, int $uploadedByUserId, int $bidYear, ?string $batchTitle = null): array
    {
        if ($sources === []) {
            throw new InvalidArgumentException('At least one CSV or XLSX file is required.');
        }

        $parsed = [];
        foreach ($sources as $i => $src) {
            $parsed[] = $this->parseFileToBuffer(
                $src['path'],
                $src['original_filename'],
                $bidYear,
                $src['source_label'] ?? null,
            );
        }

        $first = $parsed[0];
        $expectedDateKeys = array_keys($first['column_map']);
        sort($expectedDateKeys);

        for ($i = 1; $i < count($parsed); $i++) {
            $keys = array_keys($parsed[$i]['column_map']);
            sort($keys);
            if ($keys !== $expectedDateKeys) {
                throw new InvalidArgumentException(
                    'Date columns in '.($sources[$i]['original_filename'] ?? 'file '.($i + 1)).
                    ' do not match the first file. All uploads for a bid year must use the same date grid.'
                );
            }
        }

        $seenKeys = [];
        $mergedLines = [];
        $distinctCodes = [];

        foreach ($parsed as $p) {
            foreach ($p['distinct_codes'] as $code) {
                $distinctCodes[$code] = true;
            }
            foreach ($p['lines'] as $line) {
                $dupKey = $line['line_num']."\t".$line['desk_group'];
                if (isset($seenKeys[$dupKey])) {
                    throw new InvalidArgumentException(
                        'Duplicate line number and group: '.$line['line_num'].' / '.$line['desk_group'].' (appears in more than one file).'
                    );
                }
                $seenKeys[$dupKey] = true;
                $mergedLines[] = $line;
            }
        }

        $distinctCodeList = array_keys($distinctCodes);
        sort($distinctCodeList);

        if (count($sources) === 1) {
            $combinedHash = hash_file('sha256', $sources[0]['path']);
        } else {
            $hashParts = [];
            foreach ($sources as $src) {
                $hashParts[] = hash_file('sha256', $src['path']);
            }
            sort($hashParts);
            $combinedHash = hash('sha256', implode('|', $hashParts).'|bid_year:'.$bidYear);
        }

        $sourceFilesMeta = [];
        foreach ($sources as $idx => $src) {
            $sourceFilesMeta[] = [
                'filename' => $src['original_filename'],
                'title' => isset($src['source_label']) && $src['source_label'] !== ''
                    ? $src['source_label']
                    : null,
            ];
        }

        $summaryName = count($sources) === 1
            ? $sources[0]['original_filename']
            : $sources[0]['original_filename'].' (+'.(count($sources) - 1).' more)';

        if (strlen($summaryName) > 255) {
            $summaryName = count($sources).' spreadsheet files (combined)';
        }

        return $this->persistImport(
            $combinedHash,
            $summaryName,
            $uploadedByUserId,
            $bidYear,
            $mergedLines,
            $distinctCodeList,
            $first['header_index'],
            [
                'source_files' => $sourceFilesMeta,
            ],
            $batchTitle,
        );
    }

    /**
     * @return array{import: BidImport, line_count: int, distinct_codes: list<string>}
     */
    public function importFromPath(string $absolutePath, string $originalFilename, int $uploadedByUserId, int $bidYear, ?string $sourceLabel = null, ?string $batchTitle = null): array
    {
        return $this->importFromSources(
            [
                [
                    'path' => $absolutePath,
                    'original_filename' => $originalFilename,
                    'source_label' => $sourceLabel,
                ],
            ],
            $uploadedByUserId,
            $bidYear,
            $batchTitle,
        );
    }

    /**
     * @param  list<array{line_num: string, desk_group: string, start_time: string, rotation: ?string, workdays_from_file: ?int, workdays_computed: int, days: list<array>, source_label: ?string}>  $lines
     * @param  array<string, mixed>  $extraMeta
     * @return array{import: BidImport, line_count: int, distinct_codes: list<string>}
     */
    private function persistImport(
        string $hash,
        string $summaryFilename,
        int $uploadedByUserId,
        int $bidYear,
        array $lines,
        array $distinctCodeList,
        int $headerIndex,
        array $extraMeta,
        ?string $batchTitle,
    ): array {
        return DB::transaction(function () use ($hash, $summaryFilename, $uploadedByUserId, $bidYear, $lines, $distinctCodeList, $headerIndex, $extraMeta, $batchTitle) {
            BidImport::where('bid_year', $bidYear)->update(['is_current' => false]);

            $import = BidImport::create([
                'uploaded_by_user_id' => $uploadedByUserId,
                'bid_year' => $bidYear,
                'file_hash' => $hash,
                'original_filename' => $summaryFilename,
                'title' => $batchTitle !== null && $batchTitle !== '' ? $batchTitle : null,
                'is_current' => true,
                'meta' => array_merge([
                    'parser' => 'bid_line_csv_v1',
                    'header_row_index' => $headerIndex,
                    'distinct_codes' => $distinctCodeList,
                ], $extraMeta),
            ]);

            foreach ($lines as $lineData) {
                $days = $lineData['days'];
                unset($lineData['days']);

                $line = BidLine::create([
                    'bid_import_id' => $import->id,
                    'line_num' => $lineData['line_num'],
                    'desk_group' => $lineData['desk_group'],
                    'source_label' => $lineData['source_label'] ?? null,
                    'start_time' => $lineData['start_time'],
                    'rotation' => $lineData['rotation'],
                    'workdays_from_file' => $lineData['workdays_from_file'],
                    'workdays_computed' => $lineData['workdays_computed'],
                ]);

                foreach ($days as $day) {
                    BidLineDay::create([
                        'bid_line_id' => $line->id,
                        'assignment_date' => $day['assignment_date'],
                        'raw_cell' => $day['raw_cell'],
                        'is_off' => $day['is_off'],
                        'normalized_code' => $day['normalized_code'],
                    ]);
                }
            }

            return [
                'import' => $import->fresh(),
                'line_count' => count($lines),
                'distinct_codes' => $distinctCodeList,
            ];
        });
    }

    /**
     * @return array{
     *   header_index: int,
     *   column_map: array<string, int>,
     *   lines: list<array>,
     *   distinct_codes: list<string>
     * }
     */
    private function parseFileToBuffer(string $absolutePath, string $originalFilename, int $bidYear, ?string $sourceLabel): array
    {
        if (! is_readable($absolutePath)) {
            throw new RuntimeException('File is not readable: '.$originalFilename);
        }

        $range = BidYearRange::fromBidYear($bidYear);
        try {
            $rows = TabularFileReader::read($absolutePath);
        } catch (InvalidArgumentException $e) {
            throw $e;
        } catch (RuntimeException $e) {
            throw new RuntimeException($e->getMessage().' ('.$originalFilename.')', 0, $e);
        }

        if ($rows === []) {
            throw new InvalidArgumentException('Spreadsheet is empty: '.$originalFilename);
        }

        [$headerIndex, $lineNumCol, $columnMap, $workdaysCol] = $this->detectHeaderAndColumns($rows);

        ksort($columnMap);
        $expectedDates = $range->eachDate()->map(fn (CarbonImmutable $d) => $d->format('Y-m-d'))->all();
        $dateKeys = array_keys($columnMap);
        if ($dateKeys !== $expectedDates) {
            throw new InvalidArgumentException(
                'Date columns do not match bid year '.$bidYear.' (Feb 1 – Jan 31) in '.$originalFilename.
                ': found '.count($dateKeys).' day columns; expected '.count($expectedDates).'.'
            );
        }

        $distinctCodes = [];
        $lineBuffer = [];
        $trimmedSourceLabel = $sourceLabel !== null && trim($sourceLabel) !== '' ? trim($sourceLabel) : null;

        for ($i = $headerIndex + 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            $lineNum = isset($row[$lineNumCol]) ? trim((string) $row[$lineNumCol]) : '';
            if ($lineNum === '') {
                continue;
            }

            $group = isset($row[$lineNumCol + 1]) ? trim((string) $row[$lineNumCol + 1]) : '';
            $start = isset($row[$lineNumCol + 2]) ? trim((string) $row[$lineNumCol + 2]) : '';
            $rotation = isset($row[$lineNumCol + 3]) ? trim((string) $row[$lineNumCol + 3]) : null;
            if ($rotation === '') {
                $rotation = null;
            }

            $daysPayload = [];
            $workCount = 0;
            foreach ($columnMap as $ymd => $colIdx) {
                $raw = isset($row[$colIdx]) ? trim((string) $row[$colIdx]) : '';
                $isOff = $raw === '' || strcasecmp($raw, 'x') === 0;
                if (! $isOff) {
                    $workCount++;
                    $norm = strtoupper($raw);
                    $distinctCodes[$norm] = true;
                } else {
                    $norm = null;
                }
                $daysPayload[] = [
                    'assignment_date' => $ymd,
                    'raw_cell' => $raw,
                    'is_off' => $isOff,
                    'normalized_code' => $norm,
                ];
            }

            $workdaysFromFile = null;
            if ($workdaysCol !== null && isset($row[$workdaysCol])) {
                $w = trim((string) $row[$workdaysCol]);
                if ($w !== '' && ctype_digit($w)) {
                    $workdaysFromFile = (int) $w;
                }
            }

            $lineBuffer[] = [
                'line_num' => $lineNum,
                'desk_group' => $group,
                'source_label' => $trimmedSourceLabel,
                'start_time' => $start,
                'rotation' => $rotation,
                'workdays_from_file' => $workdaysFromFile,
                'workdays_computed' => $workCount,
                'days' => $daysPayload,
            ];
        }

        if ($lineBuffer === []) {
            throw new InvalidArgumentException('No data rows found after header in '.$originalFilename);
        }

        $distinctCodeList = array_keys($distinctCodes);
        sort($distinctCodeList);

        return [
            'header_index' => $headerIndex,
            'column_map' => $columnMap,
            'lines' => $lineBuffer,
            'distinct_codes' => $distinctCodeList,
        ];
    }

    /**
     * @param  list<list<string>>  $rows
     * @return array{0: int, 1: int, 2: array<string, int>, 3: int|null}
     */
    private function detectHeaderAndColumns(array $rows): array
    {
        $found = BidLineHeader::findHeaderRow($rows);

        if ($found === null) {
            throw new InvalidArgumentException(
                'Could not find a bid-line header row with "Line Num" and date columns. '
                .'If the workbook has multiple sheets, the data tab should include a full year of dates. '
                .'Preview: '.BidLineHeader::preview($rows)
            );
        }

        [$headerIndex, $lineNumCol] = [$found[0], $found[1]];
        $header = $rows[$headerIndex];
        $columnMap = [];
        $workdaysCol = null;
        $fixedEnd = $lineNumCol + 3;

        foreach ($header as $idx => $label) {
            $labelTrim = BidLineHeader::normalize((string) $label);
            if ($idx <= $fixedEnd) {
                continue;
            }
            if (strcasecmp($labelTrim, 'workdays') === 0) {
                $workdaysCol = $idx;

                continue;
            }

            $parsed = BidLineHeader::parseDateHeader($labelTrim);
            if ($parsed !== null) {
                $columnMap[$parsed] = $idx;
            }
        }

        if ($columnMap === []) {
            throw new InvalidArgumentException(
                'No date columns found in header row. Preview: '.BidLineHeader::preview($rows)
            );
        }

        return [$headerIndex, $lineNumCol, $columnMap, $workdaysCol];
    }
}
