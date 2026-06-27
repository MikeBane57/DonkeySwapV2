<?php

use App\Services\BidTools\TabularFileReader;
use App\Services\BidTools\BidYearRange;

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
            $ref = columnLetterForXlsxTest($colIndex).($rowIndex + 1);
            $escaped = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $cells .= '<c r="'.$ref.'" t="inlineStr"><is><t>'.$escaped.'</t></is></c>';
        }
        $sheetRows .= '<row r="'.($rowIndex + 1).'">'.$cells.'</row>';
    }

    $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<sheetData>'.$sheetRows.'</sheetData>'
        .'</worksheet>');

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

test('tabular file reader reads xlsx rows', function () {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension is not available.');
    }

    $path = writeXlsxWithRows([
        ['Line Num', 'Group'],
        ['1', 'DG'],
    ]);

    $rows = TabularFileReader::read($path);

    expect($rows)->toHaveCount(2);
    expect($rows[0][0])->toBe('Line Num');
    expect($rows[1][1])->toBe('DG');

    @unlink($path);
});
