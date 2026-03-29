<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('bid_year');
            $table->string('file_hash', 64);
            $table->string('original_filename', 255);
            $table->boolean('is_current')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['bid_year', 'is_current']);
        });

        Schema::create('bid_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_import_id')->constrained('bid_imports')->cascadeOnDelete();
            $table->string('line_num', 32);
            $table->string('desk_group', 64);
            $table->string('start_time', 120);
            $table->string('rotation', 32)->nullable();
            $table->unsignedSmallInteger('workdays_from_file')->nullable();
            $table->unsignedSmallInteger('workdays_computed');
            $table->timestamps();

            $table->unique(['bid_import_id', 'line_num']);
        });

        Schema::create('bid_line_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_line_id')->constrained('bid_lines')->cascadeOnDelete();
            $table->date('assignment_date');
            $table->string('raw_cell', 120);
            $table->boolean('is_off');
            $table->string('normalized_code', 120)->nullable();
            $table->timestamps();

            $table->unique(['bid_line_id', 'assignment_date']);
        });

        Schema::create('bid_scenarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('bid_import_id')->constrained('bid_imports')->cascadeOnDelete();
            $table->string('name', 120);
            $table->unsignedTinyInteger('vacation_bank')->default(15);
            $table->json('weights')->nullable();
            $table->json('holiday_rank')->nullable();
            $table->json('desk_rank')->nullable();
            $table->json('start_time_rank')->nullable();
            $table->json('personal_dates')->nullable();
            $table->json('code_overrides')->nullable();
            $table->timestamps();
        });

        Schema::create('bid_scenario_vacation_ranges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_scenario_id')->constrained('bid_scenarios')->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->timestamps();
        });

        Schema::create('bid_scenario_line_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_scenario_id')->constrained('bid_scenarios')->cascadeOnDelete();
            $table->foreignId('bid_line_id')->constrained('bid_lines')->cascadeOnDelete();
            $table->boolean('submitted_externally')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['bid_scenario_id', 'bid_line_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_scenario_line_notes');
        Schema::dropIfExists('bid_scenario_vacation_ranges');
        Schema::dropIfExists('bid_scenarios');
        Schema::dropIfExists('bid_line_days');
        Schema::dropIfExists('bid_lines');
        Schema::dropIfExists('bid_imports');
    }
};
