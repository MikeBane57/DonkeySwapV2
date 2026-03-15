<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swap_post_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('swap_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->json('changes'); // [{ "field": "cash_amount", "old": 50, "new": 100 }, ...]
            $table->timestamp('changed_at');
            $table->timestamps();

            $table->index(['swap_post_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swap_post_histories');
    }
};
