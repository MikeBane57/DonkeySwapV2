<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swap_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('swap_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('offered_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('offered_shift_id')->nullable()->constrained('shifts')->cascadeOnDelete();
            $table->string('status')->default('pending'); // pending, selected, rejected
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swap_offers');
    }
};
