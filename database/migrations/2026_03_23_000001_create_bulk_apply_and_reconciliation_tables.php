<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_apply_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::table('schedule_import_runs', function (Blueprint $table) {
            $table->foreignId('bulk_apply_batch_id')->nullable()->after('target_user_id')->constrained('bulk_apply_batches')->nullOnDelete();
        });

        Schema::create('schedule_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('bulk_apply_batch_id')->constrained('bulk_apply_batches')->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending|completed
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('schedule_reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_reconciliation_id')->constrained('schedule_reconciliations')->cascadeOnDelete();
            $table->string('type', 20); // added|removed|updated
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->json('snapshot')->nullable(); // for removed: full shift to re-add; for updated: { before, after }
            $table->string('user_action', 20)->nullable(); // accepted|rejected|kept|removed
            $table->text('reason')->nullable();
            $table->timestamps();
            $table->index(['schedule_reconciliation_id', 'type']);
        });

        Schema::table('schedule_import_run_items', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('warnings');
        });
    }

    public function down(): void
    {
        Schema::table('schedule_import_run_items', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
        Schema::table('schedule_import_runs', function (Blueprint $table) {
            $table->dropForeign(['bulk_apply_batch_id']);
        });
        Schema::dropIfExists('schedule_reconciliation_items');
        Schema::dropIfExists('schedule_reconciliations');
        Schema::dropIfExists('bulk_apply_batches');
    }
};
