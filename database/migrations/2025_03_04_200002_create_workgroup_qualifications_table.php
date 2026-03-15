<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workgroup_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workgroup_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30);
            $table->string('label', 100);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['workgroup_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workgroup_qualifications');
    }
};
