<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('first_login_at')->nullable()->after('remember_token');
            $table->json('tutorial_progress')->nullable()->after('first_login_at');
        });

        // Existing accounts: treat as already onboarded (no first-login flash on next sign-in).
        DB::table('users')->whereNull('first_login_at')->update([
            'first_login_at' => DB::raw('created_at'),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['first_login_at', 'tutorial_progress']);
        });
    }
};
