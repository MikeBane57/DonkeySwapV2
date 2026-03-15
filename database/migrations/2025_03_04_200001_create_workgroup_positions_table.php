<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroup_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->string('type', 20)->default('desk'); // desk | extra
            $table->string('sublocation_type', 30)->nullable(); // regional | sector | nextday (for SODs: G=regional, S=sector, R=nextday)
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['workgroup_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroup_positions');
    }
};
