<?php

use App\Services\BidTools\BidYearRange;

function writeMinimalBidCsv(
    int $bidYear,
    string $lineNum = '1',
    string $group = 'DG',
): string {
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'bidcsv').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    $row = [$lineNum, $group, '0600', 'A'];
    foreach ($range->eachDate() as $d) {
        $row[] = 'x';
    }
    $row[] = '0';
    fputcsv($fh, $row);
    fclose($fh);

    return $path;
}

function writeXlsxWithRows(array $rows): string
{
    $path = tempnam(sys_get_temp_dir(), 'bidxlsx').'.xlsx';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    $zip->addFromString('[Content_Types].xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
XML);

    $zip->addFromString('_rels/.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
XML);

    $zip->addFromString('xl/workbook.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
XML);

    $zip->addFromString('xl/_rels/workbook.xml.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>
XML);

    $sheetRows = '';
    foreach ($rows as $rowIndex => $row) {
        $cells = '';
        foreach ($row as $colIndex => $value) {
            $col = columnLetterForXlsxTest($colIndex);
            $ref = $col.($rowIndex + 1);
            $escaped = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $cells .= '<c r="'.$ref.'" t="inlineStr"><is><t>'.$escaped.'</t></is></c>';
        }
        $sheetRows .= '<row r="'.($rowIndex + 1).'">'.$cells.'</row>';
    }

    $zip->addFromString(
        'xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<sheetData>'.$sheetRows.'</sheetData>'
        .'</worksheet>',
    );

    $zip->close();

    return $path;
}

function columnLetterForXlsxTest(int $index): string
{
    $index++;
    $letters = '';
    while ($index > 0) {
        $index--;
        $letters = chr(ord('A') + ($index % 26)).$letters;
        $index = intdiv($index, 26);
    }

    return $letters;
}

function writeMinimalBidXlsx(
    int $bidYear,
    string $lineNum = '1',
    string $group = 'DG',
): string {
    $range = BidYearRange::fromBidYear($bidYear);
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';

    $row = [$lineNum, $group, '0600', 'A'];
    foreach ($range->eachDate() as $d) {
        $row[] = 'x';
    }
    $row[] = '0';

    return writeXlsxWithRows([$headers, $row]);
}

function writeXlsxWithSharedStrings(array $rows): string
{
    $strings = [];
    $stringIndex = [];
    $indexOf = function (string $value) use (&$strings, &$stringIndex): int {
        if (! isset($stringIndex[$value])) {
            $stringIndex[$value] = count($strings);
            $strings[] = $value;
        }

        return $stringIndex[$value];
    };

    foreach ($rows as $row) {
        foreach ($row as $value) {
            $indexOf((string) $value);
        }
    }

    $path = tempnam(sys_get_temp_dir(), 'bidxlsx').'.xlsx';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    $zip->addFromString('[Content_Types].xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>
XML);

    $zip->addFromString('_rels/.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
XML);

    $zip->addFromString('xl/workbook.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
XML);

    $zip->addFromString('xl/_rels/workbook.xml.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>
XML);

    $sharedXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'
        .count($strings).'" uniqueCount="'.count($strings).'">';
    foreach ($strings as $string) {
        $escaped = htmlspecialchars($string, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $sharedXml .= '<si><t>'.$escaped.'</t></si>';
    }
    $sharedXml .= '</sst>';
    $zip->addFromString('xl/sharedStrings.xml', $sharedXml);

    $sheetRows = '';
    foreach ($rows as $rowIndex => $row) {
        $cells = '';
        foreach ($row as $colIndex => $value) {
            $ref = columnLetterForXlsxTest($colIndex).($rowIndex + 1);
            $cells .= '<c r="'.$ref.'" t="s"><v>'.$indexOf((string) $value).'</v></c>';
        }
        $sheetRows .= '<row r="'.($rowIndex + 1).'">'.$cells.'</row>';
    }

    $zip->addFromString(
        'xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<sheetData>'.$sheetRows.'</sheetData>'
        .'</worksheet>',
    );

    $zip->close();

    return $path;
}

function writeTwoSheetBidXlsx(int $bidYear): string
{
    $range = BidYearRange::fromBidYear($bidYear);
    $headers = ['Line Number', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';

    $row = ['1', 'DG', '0600', 'A'];
    foreach ($range->eachDate() as $d) {
        $row[] = 'x';
    }
    $row[] = '0';

    $path = tempnam(sys_get_temp_dir(), 'bidxlsx').'.xlsx';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    $zip->addFromString('[Content_Types].xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
XML);

    $zip->addFromString('_rels/.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
XML);

    $zip->addFromString('xl/workbook.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Cover" sheetId="1" r:id="rId1"/>
    <sheet name="Lines" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>
XML);

    $zip->addFromString('xl/_rels/workbook.xml.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>
XML);

    $zip->addFromString(
        'xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<sheetData>'
        .'<row r="1"><c r="A1" t="inlineStr"><is><t>Instructions</t></is></c></row>'
        .'<row r="2"><c r="A2" t="inlineStr"><is><t>Line Number</t></is></c></row>'
        .'</sheetData>'
        .'</worksheet>',
    );

    $sheetRows = '';
    foreach ([$headers, $row] as $rowIndex => $cells) {
        $xmlCells = '';
        foreach ($cells as $colIndex => $value) {
            $ref = columnLetterForXlsxTest($colIndex).($rowIndex + 1);
            $escaped = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $xmlCells .= '<c r="'.$ref.'" t="inlineStr"><is><t>'.$escaped.'</t></is></c>';
        }
        $sheetRows .= '<row r="'.($rowIndex + 1).'">'.$xmlCells.'</row>';
    }

    $zip->addFromString(
        'xl/worksheets/sheet2.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<sheetData>'.$sheetRows.'</sheetData>'
        .'</worksheet>',
    );

    $zip->close();

    return $path;
}
function writeMultiLineBidCsv(int $bidYear, int $lineCount): string
{
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'bidcsv').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    for ($i = 1; $i <= $lineCount; $i++) {
        $row = [(string) (550 + $i), 'DG', '0600', 'A'];
        foreach ($range->eachDate() as $d) {
            $row[] = 'x';
        }
        $row[] = '0';
        fputcsv($fh, $row);
    }
    fclose($fh);

    return $path;
}

