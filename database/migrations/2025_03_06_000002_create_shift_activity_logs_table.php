<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->constrained()->cascadeOnDelete();
            $table->string('event_type', 64); // post_created, post_removed, assignee_changed
            $table->json('metadata')->nullable(); // e.g. { "post_type": "trade", "from_user_id": 1, "to_user_id": 2 }
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('swap_post_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('swap_offer_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['shift_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_activity_logs');
    }
};
