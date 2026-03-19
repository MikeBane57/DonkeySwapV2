<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->boolean('willing_to_follow')->default(false)->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->dropColumn('willing_to_follow');
        });
    }
};
