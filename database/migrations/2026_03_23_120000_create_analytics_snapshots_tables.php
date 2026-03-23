<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_daily_snapshots', function (Blueprint $table) {
            $table->id();
            $table->date('snapshot_date')->unique();
            $table->unsignedInteger('swap_posts_created')->default(0);
            $table->unsignedInteger('swap_posts_resolved')->default(0);
            $table->unsignedBigInteger('swap_resolve_seconds_sum')->default(0);
            $table->unsignedInteger('swap_resolve_sample_count')->default(0);
            $table->unsignedInteger('swap_offers_created')->default(0);
            $table->unsignedInteger('lfw_posts_created')->default(0);
            $table->unsignedInteger('lfw_posts_resolved')->default(0);
            $table->unsignedBigInteger('lfw_resolve_seconds_sum')->default(0);
            $table->unsignedInteger('lfw_resolve_sample_count')->default(0);
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('analytics_shift_histogram_snapshots', function (Blueprint $table) {
            $table->id();
            $table->date('as_of_date');
            $table->date('shift_date');
            $table->unsignedInteger('swap_post_count')->default(0);
            $table->timestamps();

            $table->unique(['as_of_date', 'shift_date']);
            $table->index('as_of_date');
            $table->index('shift_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_shift_histogram_snapshots');
        Schema::dropIfExists('analytics_daily_snapshots');
    }
};
