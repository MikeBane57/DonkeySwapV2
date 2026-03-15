<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroup_allowed_start_times', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->time('start_time');
            $table->integer('default_duration_minutes')->default(510);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroup_allowed_start_times');
    }
};
