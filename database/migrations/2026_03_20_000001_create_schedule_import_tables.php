<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedule_import_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('mode', 20)->default('user'); // user|admin
            $table->string('source', 50)->default('aris_expanded_schedule');
            $table->string('timezone', 64)->default('America/Chicago');
            $table->string('status', 20)->default('preview'); // preview|applied|failed
            $table->unsignedInteger('row_count')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('conflict_count')->default(0);
            $table->unsignedInteger('missing_count')->default(0);
            $table->json('meta')->nullable(); // parser version, notes, etc.
            $table->timestamps();
        });

        Schema::create('schedule_import_run_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_import_run_id')->constrained('schedule_import_runs')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('employee_id', 30)->nullable();
            $table->string('employee_name', 255)->nullable();
            $table->json('qualifications')->nullable();

            $table->date('shift_date'); // local date
            $table->string('time_code', 10)->nullable();
            $table->string('desk_code', 20)->nullable();

            $table->dateTime('start_time_utc')->nullable();
            $table->dateTime('end_time_utc')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->default(510);

            $table->unsignedBigInteger('matched_shift_id')->nullable(); // existing shift (for update-in-place)
            $table->string('action', 20)->default('skip'); // create|update|skip|conflict
            $table->string('reason', 120)->nullable();
            $table->json('warnings')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'shift_date']);
        });

        Schema::create('schedule_unmapped_codes', function (Blueprint $table) {
            $table->id();
            $table->string('source', 50)->default('aris_expanded_schedule');
            $table->string('code_type', 20); // desk|time|qual
            $table->string('code', 50);
            $table->unsignedInteger('seen_count')->default(1);
            $table->dateTime('first_seen_at')->nullable();
            $table->dateTime('last_seen_at')->nullable();
            $table->json('examples')->nullable();
            $table->timestamps();

            $table->unique(['source', 'code_type', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_unmapped_codes');
        Schema::dropIfExists('schedule_import_run_items');
        Schema::dropIfExists('schedule_import_runs');
    }
};

