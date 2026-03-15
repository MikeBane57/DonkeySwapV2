<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_banner_messages', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->string('target_type'); // all, workgroup, individual
            $table->foreignId('target_workgroup_id')->nullable()->constrained('workgroups')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('admin_banner_recipients', function (Blueprint $table) {
            $table->foreignId('admin_banner_message_id')->constrained('admin_banner_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['admin_banner_message_id', 'user_id']);
        });

        Schema::create('admin_banner_acknowledgements', function (Blueprint $table) {
            $table->foreignId('admin_banner_message_id')->constrained('admin_banner_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('acknowledged_at');
            $table->primary(['admin_banner_message_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_banner_acknowledgements');
        Schema::dropIfExists('admin_banner_recipients');
        Schema::dropIfExists('admin_banner_messages');
    }
};
