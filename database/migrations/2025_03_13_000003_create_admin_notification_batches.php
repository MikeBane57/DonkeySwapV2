<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_notification_batches', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('active_at_start')->nullable();
            $table->dateTime('active_at_end')->nullable();
            $table->timestamps();
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('admin_notification_batch_id')->nullable()->after('user_id')->constrained('admin_notification_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['admin_notification_batch_id']);
        });
        Schema::dropIfExists('admin_notification_batches');
    }
};
