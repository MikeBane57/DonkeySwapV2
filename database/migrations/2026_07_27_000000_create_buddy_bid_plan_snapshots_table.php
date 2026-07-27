<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('buddy_bid_plan_snapshots')) {
            Schema::create('buddy_bid_plan_snapshots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('buddy_bid_plan_id')
                    ->constrained('buddy_bid_plans')
                    ->cascadeOnDelete();
                $table->string('name', 120);
                $table->json('assignments');
                $table->json('summary');
                $table->json('balance');
                $table->json('participants');
                $table->timestamps();

                $table->index('buddy_bid_plan_id', 'buddy_bid_snapshots_plan_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('buddy_bid_plan_snapshots');
    }
};
