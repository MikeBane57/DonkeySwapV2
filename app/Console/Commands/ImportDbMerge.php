<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class ImportDbMerge extends Command
{
    protected $signature = 'db:import-merge
                            {--file=mysql_merge.sql : SQL file name in the app root}';

    protected $description = 'Run mysql_merge.sql on the current DB (merge/push from local). Upload the file to the server first, then run this.';

    public function handle(): int
    {
        $filename = $this->option('file');
        $path = base_path($filename);

        if (! File::isFile($path)) {
            $this->error("File not found: {$path}");
            $this->line('Generate it locally with: php scripts/sqlite-to-mysql.php --merge');
            $this->line('Then upload it to the app root on the server (FTP/SCP) and run this command again.');

            return self::FAILURE;
        }

        if (config('database.default') !== 'mysql') {
            $this->error('This command is for MySQL. Current connection: '.config('database.default'));

            return self::FAILURE;
        }

        // Apply only merge-related migrations (avoid full `migrate` on hosts with schema drift).
        $this->info('Running merge-prep migrations (schedule_import_run_items.meta only)...');
        foreach ([
            'database/migrations/2026_03_24_000001_add_meta_to_schedule_import_run_items_if_missing.php',
            'database/migrations/2026_03_25_000001_ensure_schedule_import_run_items_meta.php',
            'database/migrations/2026_03_26_000001_widen_schedule_unmapped_codes_code.php',
        ] as $relative) {
            $full = base_path($relative);
            if (is_file($full)) {
                $this->call('migrate', ['--force' => true, '--path' => $relative]);
            }
        }

        $sql = File::get($path);
        $statements = array_filter(
            array_map('trim', explode(";\n", $sql)),
            fn (string $s) => $s !== ''
        );

        $this->info('Running '.count($statements).' statements from '.$filename.'...');

        foreach ($statements as $statement) {
            $statement = trim($statement);
            if ($statement === '') {
                continue;
            }
            try {
                DB::unprepared($statement);
            } catch (\Throwable $e) {
                $this->error('Statement failed: '.substr($statement, 0, 80).'...');
                $this->error($e->getMessage());

                return self::FAILURE;
            }
        }

        $this->info('Merge import completed.');

        return self::SUCCESS;
    }
}
