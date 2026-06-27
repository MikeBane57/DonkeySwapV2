<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidYearRange;
use Illuminate\Http\UploadedFile;

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
        .'<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Bid cover page</t></is></c></row></sheetData>'
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

test('admin can upload bid csv and import lines', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $csvPath = writeMinimalBidCsv(2030);
    $upload = new UploadedFile($csvPath, 'lines.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2030,
            'files' => [$upload],
            'titles' => ['North'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    expect(BidImport::where('bid_year', 2030)->where('is_current', true)->exists())->toBeTrue();

    $line = BidLine::query()->where('line_num', '1')->first();
    expect($line)->not->toBeNull();
    expect($line->source_label)->toBe('North');

    @unlink($csvPath);
});

test('admin can upload bid xlsx and import lines', function () {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension is not available.');
    }

    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $xlsxPath = writeMinimalBidXlsx(2031);
    $upload = new UploadedFile(
        $xlsxPath,
        'lines.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2031,
            'files' => [$upload],
            'titles' => ['West'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    expect(BidImport::where('bid_year', 2031)->where('is_current', true)->exists())->toBeTrue();

    $line = BidLine::query()->where('line_num', '1')->first();
    expect($line)->not->toBeNull();
    expect($line->source_label)->toBe('West');

    @unlink($xlsxPath);
});

test('admin can upload excel file that uses shared strings', function () {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension is not available.');
    }

    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $range = BidYearRange::fromBidYear(2034);
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
    $xlsxPath = writeXlsxWithSharedStrings([$headers, $row]);
    $upload = new UploadedFile(
        $xlsxPath,
        'lines.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2034,
            'files' => [$upload],
            'titles' => ['Shared strings'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    expect(BidLine::query()->where('line_num', '1')->exists())->toBeTrue();

    @unlink($xlsxPath);
});

test('admin can upload excel file with cover sheet before bid lines', function () {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension is not available.');
    }

    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $xlsxPath = writeTwoSheetBidXlsx(2035);
    $upload = new UploadedFile(
        $xlsxPath,
        'lines.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2035,
            'files' => [$upload],
            'titles' => [''],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    expect(BidLine::query()->where('line_num', '1')->exists())->toBeTrue();

    @unlink($xlsxPath);
});

test('admin can merge multiple bid csvs for one bid year', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $pathA = writeMinimalBidCsv(2032, '1', 'DG-A');
    $pathB = writeMinimalBidCsv(2032, '1', 'DG-B');
    $upA = new UploadedFile($pathA, 'a.csv', 'text/csv', null, true);
    $upB = new UploadedFile($pathB, 'b.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2032,
            'batch_title' => 'Combined 2032',
            'files' => [$upA, $upB],
            'titles' => ['Workgroup A', 'Workgroup B'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    $imp = BidImport::where('bid_year', 2032)->where('is_current', true)->first();
    expect($imp)->not->toBeNull();
    expect($imp->title)->toBe('Combined 2032');
    expect(BidLine::query()->where('bid_import_id', $imp->id)->count())->toBe(2);

    expect(BidLine::query()->where('desk_group', 'DG-A')->value('source_label'))->toBe('Workgroup A');
    expect(BidLine::query()->where('desk_group', 'DG-B')->value('source_label'))->toBe('Workgroup B');

    @unlink($pathA);
    @unlink($pathB);
});

test('merged import rejects duplicate line number and group across files', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $pathA = writeMinimalBidCsv(2033, '1', 'SAME');
    $pathB = writeMinimalBidCsv(2033, '1', 'SAME');
    $upA = new UploadedFile($pathA, 'a.csv', 'text/csv', null, true);
    $upB = new UploadedFile($pathB, 'b.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2033,
            'files' => [$upA, $upB],
            'titles' => ['', ''],
        ])
        ->assertSessionHasErrors('files');

    @unlink($pathA);
    @unlink($pathB);
});

test('import service rejects csv with wrong date span', function () {
    $path = tempnam(sys_get_temp_dir(), 'bad').'.csv';
    $fh = fopen($path, 'wb');
    fputcsv($fh, ['Line Num', 'Group', 'Start Time', 'Rotation', '1-Feb-30', '2-Feb-30']);
    fputcsv($fh, ['1', 'DG', '0600', 'A', 'x', 'x']);
    fclose($fh);

    $user = User::factory()->create();
    $service = new BidLineCsvImportService;

    $service->importFromPath($path, 'bad.csv', $user->id, 2030);
})->throws(InvalidArgumentException::class);
