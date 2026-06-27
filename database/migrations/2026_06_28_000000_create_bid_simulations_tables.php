<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_simulations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('bid_import_id')->constrained('bid_imports')->cascadeOnDelete();
            $table->string('name', 120);
            $table->timestamp('last_run_at')->nullable();
            $table->json('last_run_results')->nullable();
            $table->timestamps();
        });

        Schema::create('bid_simulation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_simulation_id')->constrained('bid_simulations')->cascadeOnDelete();
            $table->unsignedSmallInteger('seniority_rank');
            $table->string('display_name', 120);
            $table->foreignId('bid_scenario_id')->constrained('bid_scenarios')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['bid_simulation_id', 'seniority_rank']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_simulation_participants');
        Schema::dropIfExists('bid_simulations');
    }
};
