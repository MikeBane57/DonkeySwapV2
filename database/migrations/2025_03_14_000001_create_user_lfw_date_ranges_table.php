<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_lfw_date_ranges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title')->default('LFW');
            $table->date('date_from');
            $table->date('date_to');
            $table->timestamps();

            $table->index(['user_id', 'date_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_lfw_date_ranges');
    }
};
