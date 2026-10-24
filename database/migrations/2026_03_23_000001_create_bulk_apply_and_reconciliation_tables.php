<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bulk_apply_batches')) {
            Schema::create('bulk_apply_batches', function (Blueprint $table) {
                $table->id();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('schedule_import_runs') && ! Schema::hasColumn('schedule_import_runs', 'bulk_apply_batch_id')) {
            Schema::table('schedule_import_runs', function (Blueprint $table) {
                $table->foreignId('bulk_apply_batch_id')->nullable()->after('target_user_id')->constrained('bulk_apply_batches')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('schedule_reconciliations')) {
            Schema::create('schedule_reconciliations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('bulk_apply_batch_id')->constrained('bulk_apply_batches')->cascadeOnDelete();
                $table->string('status', 20)->default('pending'); // pending|completed
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index(['user_id', 'status']);
            });
        }

        if (! Schema::hasTable('schedule_reconciliation_items')) {
            Schema::create('schedule_reconciliation_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('schedule_reconciliation_id')->constrained('schedule_reconciliations')->cascadeOnDelete();
                $table->string('type', 20); // added|removed|updated
                $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
                $table->json('snapshot')->nullable(); // for removed: full shift to re-add; for updated: { before, after }
                $table->string('user_action', 20)->nullable(); // accepted|rejected|kept|removed
                $table->text('reason')->nullable();
                $table->timestamps();
                // MySQL 5.7 identifier limit is 64 chars; Laravel's auto name is too long.
                $table->index(['schedule_reconciliation_id', 'type'], 'sched_recon_items_recon_type_idx');
            });
        }

        if (Schema::hasTable('schedule_import_run_items') && ! Schema::hasColumn('schedule_import_run_items', 'meta')) {
            Schema::table('schedule_import_run_items', function (Blueprint $table) {
                $table->json('meta')->nullable()->after('warnings');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('schedule_import_run_items') && Schema::hasColumn('schedule_import_run_items', 'meta')) {
            Schema::table('schedule_import_run_items', function (Blueprint $table) {
                $table->dropColumn('meta');
            });
        }
        if (Schema::hasTable('schedule_import_runs') && Schema::hasColumn('schedule_import_runs', 'bulk_apply_batch_id')) {
            Schema::table('schedule_import_runs', function (Blueprint $table) {
                $table->dropForeign(['bulk_apply_batch_id']);
            });
        }
        Schema::dropIfExists('schedule_reconciliation_items');
        Schema::dropIfExists('schedule_reconciliations');
        Schema::dropIfExists('bulk_apply_batches');
    }
};
