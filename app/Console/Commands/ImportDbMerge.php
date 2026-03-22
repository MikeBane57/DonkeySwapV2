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
