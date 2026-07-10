<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buddy_bid_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('bid_import_id')->constrained('bid_imports')->cascadeOnDelete();
            $table->string('name', 120);
            $table->timestamps();
        });

        Schema::create('buddy_bid_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buddy_bid_plan_id')->constrained('buddy_bid_plans')->cascadeOnDelete();
            $table->unsignedTinyInteger('slot')->comment('1 = user A, 2 = user B');
            $table->string('display_name', 120);
            $table->foreignId('bid_line_id')->nullable()->constrained('bid_lines')->nullOnDelete();
            $table->json('profile')->nullable();
            $table->timestamps();

            $table->unique(['buddy_bid_plan_id', 'slot']);
        });

        Schema::create('buddy_bid_day_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buddy_bid_plan_id')->constrained('buddy_bid_plans')->cascadeOnDelete();
            $table->date('assignment_date');
            $table->foreignId('double_participant_id')->nullable()->constrained('buddy_bid_participants')->nullOnDelete();
            $table->timestamps();

            $table->unique(['buddy_bid_plan_id', 'assignment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('buddy_bid_day_assignments');
        Schema::dropIfExists('buddy_bid_participants');
        Schema::dropIfExists('buddy_bid_plans');
    }
};
