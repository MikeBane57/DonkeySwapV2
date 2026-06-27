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

        $sharedStrings = self::readSharedStrings($zip);
        $sheetPaths = self::discoverWorksheetPaths($zip);
        $bestRows = null;
        $bestDateCount = -1;
        $fallbackRows = [];

        foreach ($sheetPaths as $sheetPath) {
            $sheetXml = $zip->getFromName($sheetPath);
            if ($sheetXml === false) {
                continue;
            }

            $rows = self::parseSheetXml($sheetXml, $sharedStrings);
            if ($rows === []) {
                continue;
            }

            $fallbackRows = $rows;

            $found = BidLineHeader::findHeaderRow($rows);
            if ($found !== null && $found[2] > $bestDateCount) {
                $bestDateCount = $found[2];
                $bestRows = $rows;
            }
        }

        $zip->close();

        return $bestRows ?? $fallbackRows;
    }

    /**
     * @return list<string>
     */
    private static function discoverWorksheetPaths(ZipArchive $zip): array
    {
        $paths = self::resolveWorksheetPaths($zip);

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (is_string($name) && preg_match('#^xl/worksheets/sheet\d+\.xml$#', $name) === 1) {
                $paths[] = $name;
            }
        }

        return array_values(array_unique($paths));
    }

    /**
     * @return list<string>
     */
    private static function resolveWorksheetPaths(ZipArchive $zip): array
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');

        if ($workbookXml === false || $relsXml === false) {
            return ['xl/worksheets/sheet1.xml'];
        }

        $workbook = new SimpleXMLElement($workbookXml);
        $rels = new SimpleXMLElement($relsXml);
        $mainNs = self::mainNamespace($workbook);
        $relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

        $relMap = [];
        foreach ($rels->Relationship as $rel) {
            $relMap[(string) $rel['Id']] = (string) $rel['Target'];
        }

        $paths = [];
        $sheets = $workbook->children($mainNs)->sheets;
        if ($sheets->count() === 0) {
            return ['xl/worksheets/sheet1.xml'];
        }

        foreach ($sheets->children($mainNs) as $sheet) {
            if ($sheet->getName() !== 'sheet') {
                continue;
            }

            $relId = (string) ($sheet->attributes($relNs)['id'] ?? '');
            if ($relId === '' || ! isset($relMap[$relId])) {
                continue;
            }

            $target = ltrim($relMap[$relId], '/');
            $paths[] = str_starts_with($target, 'xl/') ? $target : 'xl/'.$target;
        }

        return $paths !== [] ? $paths : ['xl/worksheets/sheet1.xml'];
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
        $mainNs = self::mainNamespace($shared);
        $strings = [];

        foreach ($shared->children($mainNs) as $si) {
            if ($si->getName() !== 'si') {
                continue;
            }

            $strings[] = self::sharedStringItemText($si, $mainNs);
        }

        return $strings;
    }

    private static function sharedStringItemText(SimpleXMLElement $si, string $mainNs): string
    {
        $children = $si->children($mainNs);
        if (isset($children->t)) {
            return (string) $children->t;
        }

        $parts = [];
        foreach ($children->r as $run) {
            $runChildren = $run->children($mainNs);
            $parts[] = (string) ($runChildren->t ?? '');
        }

        return implode('', $parts);
    }

    /**
     * @param  list<string>  $sharedStrings
     * @return list<list<string>>
     */
    private static function parseSheetXml(string $sheetXml, array $sharedStrings): array
    {
        $sheet = new SimpleXMLElement($sheetXml);
        $mainNs = self::mainNamespace($sheet);
        $sheetData = $sheet->children($mainNs)->sheetData;

        if ($sheetData->count() === 0) {
            return [];
        }

        $rows = [];
        foreach ($sheetData->children($mainNs) as $row) {
            if ($row->getName() !== 'row') {
                continue;
            }

            $cells = [];
            $maxIndex = -1;

            foreach ($row->children($mainNs) as $cell) {
                if ($cell->getName() !== 'c') {
                    continue;
                }

                $ref = (string) ($cell['r'] ?? '');
                $index = $ref !== '' ? self::columnIndexFromCellRef($ref) : $maxIndex + 1;
                $cells[$index] = self::cellValue($cell, $sharedStrings, $mainNs);
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

    private static function mainNamespace(SimpleXMLElement $element): string
    {
        $namespaces = $element->getNamespaces(true);

        return $namespaces[''] ?? 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
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
    private static function cellValue(SimpleXMLElement $cell, array $sharedStrings, string $mainNs): string
    {
        $type = (string) ($cell['t'] ?? '');
        $children = $cell->children($mainNs);

        if ($type === 's') {
            $idx = (int) (string) ($children->v ?? 0);

            return $sharedStrings[$idx] ?? '';
        }

        if ($type === 'inlineStr' && isset($children->is)) {
            $is = $children->is->children($mainNs);

            return (string) ($is->t ?? '');
        }

        if ($type === 'str') {
            return trim((string) ($children->v ?? ''));
        }

        if ($type === 'b') {
            return ((string) ($children->v ?? '0')) === '1' ? 'TRUE' : 'FALSE';
        }

        if (isset($children->v)) {
            return trim((string) $children->v);
        }

        return '';
    }
}
