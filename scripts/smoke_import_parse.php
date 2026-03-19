<?php

require __DIR__.'/../vendor/autoload.php';

use App\Services\ScheduleImport\ArisExpandedScheduleCsvParser;

$path = $argv[1] ?? null;
if (! $path || ! file_exists($path)) {
    fwrite(STDERR, "Usage: php scripts/smoke_import_parse.php <path-to-csv>\n");
    exit(2);
}

$csv = file_get_contents($path);
$parser = new ArisExpandedScheduleCsvParser();
$parsed = $parser->parse($csv);
$rows = $parsed['rows'];
$pastCount = $parsed['past_count'];

echo "rows: ".count($rows).", past_count: ".$pastCount.PHP_EOL;
echo json_encode(array_slice($rows, 0, 5), JSON_PRETTY_PRINT).PHP_EOL;

