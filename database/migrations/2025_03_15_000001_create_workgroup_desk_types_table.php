<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroup_desk_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64); // e.g. domestic_dispatch, assistant_desk, regional
            $table->string('label', 100); // e.g. "Domestic dispatch", "Regional (G)"
            $table->foreignId('workgroup_qualification_id')->nullable()->constrained('workgroup_qualifications')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['workgroup_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroup_desk_types');
    }
};
