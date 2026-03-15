<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('regulatory')->default(false);
            $table->integer('max_hours_per_day')->default(10);
            $table->integer('rest_required_hours')->default(8);
            $table->boolean('allow_double')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroups');
    }
};
