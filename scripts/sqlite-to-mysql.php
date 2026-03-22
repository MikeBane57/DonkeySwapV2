#!/usr/bin/env php
<?php

/**
 * Export SQLite database to MySQL-compatible SQL.
 * Run from project root: php scripts/sqlite-to-mysql.php
 *   - Default: creates mysql_export.sql (DROP + CREATE + INSERT) — full replace.
 *   - With --merge: creates mysql_merge.sql (INSERT ... ON DUPLICATE KEY UPDATE) — push data without dropping live tables.
 *   - With --merge --for-github: also writes deploy/to-live/mysql_merge.sql (commit + push → GitHub Action FTPs and imports).
 * Requires .env with DB_CONNECTION=sqlite and database/database.sqlite present.
 */
$projectRoot = dirname(__DIR__);
require $projectRoot.'/vendor/autoload.php';
$app = require_once $projectRoot.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$connection = config('database.default');
if ($connection !== 'sqlite') {
    fwrite(STDERR, "Error: DB_CONNECTION must be sqlite in .env (currently: {$connection}).\n");
    exit(1);
}

$path = config('database.connections.sqlite.database');
if (! is_file($path)) {
    fwrite(STDERR, "Error: SQLite file not found: {$path}\n");
    exit(1);
}

$merge = in_array('--merge', $argv ?? [], true) || in_array('--push', $argv ?? [], true);
$forGithub = in_array('--for-github', $argv ?? [], true) || in_array('--for-commit', $argv ?? [], true);
if ($forGithub && ! $merge) {
    fwrite(STDERR, "Error: --for-github requires --merge (or --push).\n");
    exit(1);
}

$pdo = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// Tables to export
$stmt = $pdo->query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$out = [];
// Start with a valid SQL statement (no comment on line 1) so phpMyAdmin import works
$out[] = 'SET FOREIGN_KEY_CHECKS = 0;';
$out[] = 'SET NAMES utf8mb4;';
$out[] = '';

$quoteId = fn ($id) => '"'.str_replace('"', '""', $id).'"';
$escape = fn ($v) => $v === null ? 'NULL' : "'".str_replace(['\\', "'"], ['\\\\', "\\'"], (string) $v)."'";

foreach ($tables as $table) {
    $info = $pdo->query('PRAGMA table_info('.$quoteId($table).')')->fetchAll(PDO::FETCH_ASSOC);
    $pkColumns = []; // name => order (1, 2, 3...) for composite PK
    foreach ($info as $c) {
        $pkOrder = (int) $c['pk'];
        if ($pkOrder > 0) {
            $pkColumns[$c['name']] = $pkOrder;
        }
    }
    $singleIntegerPk = null;
    if (count($pkColumns) === 1) {
        $onlyPk = array_key_first($pkColumns);
        $onlyInfo = array_values(array_filter($info, fn ($c) => $c['name'] === $onlyPk))[0] ?? null;
        if ($onlyInfo && strtoupper((string) $onlyInfo['type']) === 'INTEGER') {
            $singleIntegerPk = $onlyPk;
        }
    }

    $cols = [];
    foreach ($info as $c) {
        $name = $c['name'];
        $type = strtoupper((string) $c['type']);
        $notnull = (int) $c['notnull'] === 1;
        $isPk = (int) $c['pk'] >= 1;

        if ($singleIntegerPk === $name) {
            $cols[] = '`'.$name.'` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY';
        } elseif ($type === 'INTEGER') {
            $cols[] = '`'.$name.'` BIGINT UNSIGNED '.($notnull ? 'NOT NULL' : 'NULL');
        } elseif (str_contains($type, 'INT')) {
            $cols[] = '`'.$name.'` INT '.($notnull ? 'NOT NULL' : 'NULL');
        } elseif ($type === 'TEXT') {
            $cols[] = '`'.$name.'` TEXT '.($notnull ? 'NOT NULL' : 'NULL');
        } elseif (str_starts_with($type, 'VARCHAR') || str_starts_with($type, 'CHAR')) {
            $mysqlType = $type;
            if ($type === 'VARCHAR' || preg_match('/^VARCHAR\s*$/i', $type)) {
                $mysqlType = 'VARCHAR(255)';
            } elseif ($type === 'CHAR') {
                $mysqlType = 'CHAR(1)';
            }
            $cols[] = '`'.$name.'` '.$mysqlType.' '.($notnull ? 'NOT NULL' : 'NULL');
        } elseif ($type === 'REAL' || $type === 'FLOAT' || $type === 'DOUBLE') {
            $cols[] = '`'.$name.'` DOUBLE '.($notnull ? 'NOT NULL' : 'NULL');
        } elseif ($type === 'BLOB') {
            $cols[] = '`'.$name.'` LONGBLOB '.($notnull ? 'NOT NULL' : 'NULL');
        } else {
            $cols[] = '`'.$name.'` TEXT '.($notnull ? 'NOT NULL' : 'NULL');
        }
    }
    if ($singleIntegerPk === null && ! empty($pkColumns)) {
        asort($pkColumns);
        $cols[] = 'PRIMARY KEY ('.implode(', ', array_map(fn ($n) => '`'.$n.'`', array_keys($pkColumns))).')';
    } elseif ($singleIntegerPk === null && ! empty($info)) {
        $first = $info[0];
        if ((int) $first['pk'] === 1) {
            $cols[0] = '`'.$first['name'].'` VARCHAR(255) NOT NULL PRIMARY KEY';
        }
    }

    if (! $merge) {
        $out[] = "DROP TABLE IF EXISTS `{$table}`;";
        $out[] = "CREATE TABLE `{$table}` (\n  ".implode(",\n  ", $cols)."\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        $out[] = '';
    }

    $rows = $pdo->query('SELECT * FROM '.$quoteId($table))->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) > 0) {
        $columns = array_keys($rows[0]);
        $colList = implode(', ', array_map(fn ($c) => '`'.$c.'`', $columns));

        if ($merge && ! empty($pkColumns)) {
            // INSERT ... ON DUPLICATE KEY UPDATE: update all columns except PK(s)
            $updateCols = array_diff($columns, array_keys($pkColumns));
            $updateClause = implode(', ', array_map(fn ($c) => '`'.$c.'`=VALUES(`'.$c.'`)', $updateCols));
            if ($updateClause === '') {
                // Composite PK with no other columns: use a no-op so syntax is valid
                $firstPk = array_key_first($pkColumns);
                $updateClause = '`'.$firstPk.'`=VALUES(`'.$firstPk.'`)';
            }
            foreach ($rows as $row) {
                $values = array_map(fn ($col) => $escape($row[$col]), $columns);
                $out[] = "INSERT INTO `{$table}` ({$colList}) VALUES (".implode(', ', $values).') ON DUPLICATE KEY UPDATE '.$updateClause.';';
            }
        } elseif ($merge && empty($pkColumns)) {
            fwrite(STDERR, "Warning: Table `{$table}` has no primary key; skipping in merge mode.\n");
        } else {
            foreach ($rows as $row) {
                $values = array_map(fn ($col) => $escape($row[$col]), $columns);
                $out[] = "INSERT INTO `{$table}` ({$colList}) VALUES (".implode(', ', $values).');';
            }
        }
        $out[] = '';
    }
}

$out[] = 'SET FOREIGN_KEY_CHECKS = 1;';

$sql = implode("\n", $out);
$outPath = $projectRoot.DIRECTORY_SEPARATOR.($merge ? 'mysql_merge.sql' : 'mysql_export.sql');
// Write UTF-8 without BOM so phpMyAdmin and MySQL are happy
file_put_contents($outPath, $sql, LOCK_EX);
fwrite(STDERR, 'Written: '.$outPath.($merge ? ' (merge mode — import this to update live without dropping tables)' : '')."\n");

if ($merge && $forGithub) {
    $toLiveDir = $projectRoot.DIRECTORY_SEPARATOR.'deploy'.DIRECTORY_SEPARATOR.'to-live';
    if (! is_dir($toLiveDir)) {
        mkdir($toLiveDir, 0755, true);
    }
    $deployPath = $toLiveDir.DIRECTORY_SEPARATOR.'mysql_merge.sql';
    file_put_contents($deployPath, $sql, LOCK_EX);
    fwrite(STDERR, 'Written (for GitHub Actions): '.$deployPath."\n");
    fwrite(STDERR, "Next: git add deploy/to-live/mysql_merge.sql && git commit && git push;\n");
    fwrite(STDERR, "then GitHub Actions → \"Push DB merge to live\" → Run workflow (manual only).\n");
    fwrite(STDERR, "After you verify live: git rm deploy/to-live/mysql_merge.sql && git commit && git push.\n");
}
