<?php

require __DIR__.'/../vendor/autoload.php';

use App\Services\ScheduleImport\ArisExpandedSchedulePdfParser;

$path = $argv[1] ?? null;
if (! $path || ! file_exists($path)) {
    fwrite(STDERR, "Usage: php scripts/smoke_import_parse_pdf.php <path-to-pdf>\n");
    exit(2);
}

$content = file_get_contents($path);
$parser = new ArisExpandedSchedulePdfParser;
$parsed = $parser->parse($content, true);
$rows = $parsed['rows'];
$pastCount = $parsed['past_count'];

if (isset($parsed['diagnostics'])) {
    echo 'diagnostics (per page: grid_rows, date_columns, blocks):'.PHP_EOL;
    foreach ($parsed['diagnostics'] as $i => $d) {
        echo '  page '.($i + 1).': grid_rows='.$d['grid_rows'].', date_columns='.$d['date_columns'].', blocks='.$d['blocks'].PHP_EOL;
        if (isset($d['grid_sample'])) {
            echo '  grid_sample (first 20 rows, first 12 cells):'.PHP_EOL;
            foreach ($d['grid_sample'] as $ri => $r) {
                $preview = array_map(fn ($c) => strlen((string) $c) > 15 ? substr((string) $c, 0, 14).'…' : (string) $c, $r);
                echo '    row '.$ri.': '.json_encode($preview).PHP_EOL;
            }
        }
    }
}
echo 'rows: '.count($rows).', past_count: '.$pastCount.PHP_EOL;

$mar29 = array_filter($rows, fn ($r) => ($r['employee_id'] ?? '') === '99917' && str_contains((string) ($r['shift_date'] ?? ''), '03-29'));
if (count($mar29) > 0) {
    echo 'Michael 99917 on March 29:'.PHP_EOL;
    foreach ($mar29 as $r) {
        echo '  '.$r['shift_date'].' '.$r['time_code'].' '.$r['desk_code'].PHP_EOL;
    }
}

echo json_encode(array_slice($rows, 0, 5), JSON_PRETTY_PRINT).PHP_EOL;
