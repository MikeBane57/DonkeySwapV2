<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rotation_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('position_name');
            $table->string('pattern_type')->default('5_3_5_5'); // 5 working, 3 off, 5 working, 5 off
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rotation_schedules');
    }
};
