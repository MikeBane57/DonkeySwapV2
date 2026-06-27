<?php

namespace App\Services\BidTools;

use InvalidArgumentException;
use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

final class TabularFileReader
{
    /**
     * @return list<list<string>>
     */
    public static function read(string $path): array
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($ext) {
            'csv', 'txt' => self::readCsv($path),
            'xlsx' => self::readXlsx($path),
            default => throw new InvalidArgumentException(
                'Unsupported file type .'.$ext.'. Upload a CSV or XLSX file.'
            ),
        };
    }

    /**
     * @return list<list<string>>
     */
    private static function readCsv(string $path): array
    {
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            throw new RuntimeException('Could not open CSV file.');
        }

        $rows = [];
        $first = true;
        while (($row = fgetcsv($fh)) !== false) {
            if ($first && isset($row[0])) {
                $row[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $row[0]) ?? (string) $row[0];
                $first = false;
            }
            $rows[] = array_map(fn ($c) => (string) $c, $row);
        }
        fclose($fh);

        return $rows;
    }

    /**
     * @return list<list<string>>
     */
    private static function readXlsx(string $path): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('PHP Zip extension is required to read XLSX files.');
        }

        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('Could not open XLSX file.');
        }

        $sheetPath = self::resolveFirstSheetPath($zip);
        $sheetXml = $zip->getFromName($sheetPath);
        if ($sheetXml === false) {
            $zip->close();
            throw new RuntimeException('Could not read worksheet from XLSX file.');
        }

        $sharedStrings = self::readSharedStrings($zip);
        $zip->close();

        return self::parseSheetXml($sheetXml, $sharedStrings);
    }

    private static function resolveFirstSheetPath(ZipArchive $zip): string
    {
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($relsXml !== false) {
            $rels = new SimpleXMLElement($relsXml);
            foreach ($rels->Relationship as $rel) {
                $type = (string) $rel['Type'];
                if (str_ends_with($type, '/worksheet')) {
                    $target = ltrim((string) $rel['Target'], '/');

                    return str_starts_with($target, 'xl/') ? $target : 'xl/'.$target;
                }
            }
        }

        return 'xl/worksheets/sheet1.xml';
    }

    /**
     * @return list<string>
     */
    private static function readSharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if ($xml === false) {
            return [];
        }

        $shared = new SimpleXMLElement($xml);
        $strings = [];

        foreach ($shared->si as $si) {
            if (isset($si->t)) {
                $strings[] = (string) $si->t;

                continue;
            }

            $parts = [];
            foreach ($si->r as $run) {
                $parts[] = (string) ($run->t ?? '');
            }
            $strings[] = implode('', $parts);
        }

        return $strings;
    }

    /**
     * @param  list<string>  $sharedStrings
     * @return list<list<string>>
     */
    private static function parseSheetXml(string $sheetXml, array $sharedStrings): array
    {
        $sheet = new SimpleXMLElement($sheetXml);
        $rows = [];

        $sheetData = $sheet->sheetData ?? $sheet;
        foreach ($sheetData->row as $row) {
            $cells = [];
            $maxIndex = -1;

            foreach ($row->c as $cell) {
                $ref = (string) ($cell['r'] ?? '');
                $index = $ref !== '' ? self::columnIndexFromCellRef($ref) : $maxIndex + 1;
                $cells[$index] = self::cellValue($cell, $sharedStrings);
                $maxIndex = max($maxIndex, $index);
            }

            if ($maxIndex < 0) {
                $rows[] = [];

                continue;
            }

            $dense = [];
            for ($i = 0; $i <= $maxIndex; $i++) {
                $dense[] = $cells[$i] ?? '';
            }
            $rows[] = $dense;
        }

        return $rows;
    }

    private static function columnIndexFromCellRef(string $cellRef): int
    {
        if (! preg_match('/^([A-Z]+)/', strtoupper($cellRef), $matches)) {
            return 0;
        }

        $letters = $matches[1];
        $index = 0;
        $length = strlen($letters);
        for ($i = 0; $i < $length; $i++) {
            $index = $index * 26 + (ord($letters[$i]) - ord('A') + 1);
        }

        return $index - 1;
    }

    /**
     * @param  list<string>  $sharedStrings
     */
    private static function cellValue(SimpleXMLElement $cell, array $sharedStrings): string
    {
        $type = (string) ($cell['t'] ?? '');

        if ($type === 's') {
            $idx = (int) ($cell->v ?? 0);

            return $sharedStrings[$idx] ?? '';
        }

        if ($type === 'inlineStr') {
            return (string) ($cell->is->t ?? '');
        }

        if ($type === 'b') {
            return ((string) ($cell->v ?? '0')) === '1' ? 'TRUE' : 'FALSE';
        }

        if (isset($cell->v)) {
            return trim((string) $cell->v);
        }

        return '';
    }
}
