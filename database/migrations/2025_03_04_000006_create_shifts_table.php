<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->string('position_name');
            $table->dateTime('start_time_utc');
            $table->dateTime('end_time_utc');
            $table->boolean('regulatory')->default(false);
            $table->timestamps();

            $table->index(['start_time_utc', 'end_time_utc']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
