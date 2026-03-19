<?php

$path = $argv[1] ?? null;
if (! $path || ! file_exists($path)) {
    fwrite(STDERR, "Usage: php scripts/debug_csv_row.php <path-to-csv>\n");
    exit(2);
}

$lines = file($path, FILE_IGNORE_NEW_LINES);
foreach ([0, 1, 2, 3] as $idx) {
    $row = str_getcsv($lines[$idx] ?? '', ',', '"', '\\');
    echo "ROW $idx cols=".count($row).PHP_EOL;
    foreach ($row as $i => $v) {
        $v2 = (string) $v;
        if ($v2 !== '') {
            echo "  [$i] = $v2".PHP_EOL;
        }
    }
}

