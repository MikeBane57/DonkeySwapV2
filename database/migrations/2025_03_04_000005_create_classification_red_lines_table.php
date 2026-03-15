<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classification_red_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->integer('red_line_position');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classification_red_lines');
    }
};
