<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroup_position_ranges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->string('range_spec', 100); // e.g. "1-98", "100-130", "A", "G1-G4", "Training"
            $table->string('parity', 10)->nullable(); // even | odd (for numeric ranges only)
            $table->string('range_type', 30); // domestic_dispatch, assistant_desk, etops, intl, regional, sector, nextday, extra
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['workgroup_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroup_position_ranges');
    }
};
