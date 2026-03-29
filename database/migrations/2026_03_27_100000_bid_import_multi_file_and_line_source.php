<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('bid_imports', 'title')) {
            Schema::table('bid_imports', function (Blueprint $table) {
                $table->string('title', 160)->nullable()->after('original_filename');
            });
        }

        if (! Schema::hasColumn('bid_lines', 'source_label')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->string('source_label', 120)->nullable()->after('desk_group');
            });
        }

        $isMysql = Schema::getConnection()->getDriverName() === 'mysql';

        // MySQL: FK on bid_import_id uses the leftmost columns of the unique index.
        // Add a plain index first, then drop the unique, or migration fails with ER_DROP_INDEX_FK (1553).
        if ($isMysql && ! $this->mysqlIndexExists('bid_lines', 'bid_lines_bid_import_id_index')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->index('bid_import_id');
            });
        }

        if (! $isMysql || $this->mysqlIndexExists('bid_lines', 'bid_lines_bid_import_id_line_num_unique')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->dropUnique(['bid_import_id', 'line_num']);
            });
        }

        $hasNewUnique = $isMysql
            ? $this->mysqlIndexExists('bid_lines', 'bid_lines_bid_import_id_line_num_desk_group_unique')
            : $this->sqliteUniqueExists('bid_lines', ['bid_import_id', 'line_num', 'desk_group']);

        if (! $hasNewUnique) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->unique(['bid_import_id', 'line_num', 'desk_group']);
            });
        }

        if ($isMysql && $this->mysqlIndexExists('bid_lines', 'bid_lines_bid_import_id_index')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->dropIndex(['bid_import_id']);
            });
        }
    }

    public function down(): void
    {
        $isMysql = Schema::getConnection()->getDriverName() === 'mysql';

        if ($isMysql) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->index('bid_import_id');
            });
        }

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->dropUnique(['bid_import_id', 'line_num', 'desk_group']);
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->unique(['bid_import_id', 'line_num']);
        });

        if ($isMysql && $this->mysqlIndexExists('bid_lines', 'bid_lines_bid_import_id_index')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->dropIndex(['bid_import_id']);
            });
        }

        if (Schema::hasColumn('bid_lines', 'source_label')) {
            Schema::table('bid_lines', function (Blueprint $table) {
                $table->dropColumn('source_label');
            });
        }

        if (Schema::hasColumn('bid_imports', 'title')) {
            Schema::table('bid_imports', function (Blueprint $table) {
                $table->dropColumn('title');
            });
        }
    }

    private function mysqlIndexExists(string $table, string $indexName): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();

        return (int) DB::selectOne(
            'select count(*) as c from information_schema.statistics where table_schema = ? and table_name = ? and index_name = ?',
            [$db, $table, $indexName],
        )->c > 0;
    }

    private function sqliteUniqueExists(string $table, array $columns): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            return false;
        }

        $indexes = DB::select("PRAGMA index_list('{$table}')");

        foreach ($indexes as $idx) {
            if (empty($idx->unique)) {
                continue;
            }
            $info = DB::select("PRAGMA index_info('{$idx->name}')");
            $cols = array_map(fn ($r) => $r->name, $info);
            if ($cols === $columns) {
                return true;
            }
        }

        return false;
    }
};
