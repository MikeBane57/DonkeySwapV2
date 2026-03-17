<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('looking_for_work_post_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('looking_for_work_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->json('changes');
            $table->timestamp('changed_at');
            $table->timestamps();

            $table->index(['looking_for_work_post_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('looking_for_work_post_histories');
    }
};
