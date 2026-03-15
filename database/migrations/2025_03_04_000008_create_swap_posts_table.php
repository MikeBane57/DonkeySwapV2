<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swap_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // cash, trade, flight_follow
            $table->decimal('cash_amount', 10, 2)->nullable();
            $table->integer('flight_follow_minutes')->nullable();
            $table->string('status')->default('open'); // open, accepted, closed, cancelled
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swap_posts');
    }
};
