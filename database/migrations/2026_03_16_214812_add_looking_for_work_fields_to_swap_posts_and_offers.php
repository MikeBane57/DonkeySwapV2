<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds "Looking for work" post type: swap_posts gets seeking_* fields (shift_id stays required for existing types).
     * We use a separate table for seeking posts so we don't have to make shift_id nullable.
     */
    public function up(): void
    {
        Schema::create('looking_for_work_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('seeking_date');
            $table->json('seeking_desk_types')->nullable(); // array of desk type codes
            $table->decimal('seeking_cash', 10, 2);
            $table->boolean('seeking_obo')->default(false);
            $table->string('status')->default('open'); // open, accepted, closed
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['seeking_date', 'status']);
        });

        Schema::create('looking_for_work_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('looking_for_work_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('offered_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('offered_shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->decimal('offered_cash', 10, 2)->nullable(); // responder's cash offer when post is OBO
            $table->text('response_notes')->nullable();
            $table->string('status')->default('pending'); // pending, selected, rejected
            $table->timestamps();
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('looking_for_work_offers');
        Schema::dropIfExists('looking_for_work_posts');
    }
};
