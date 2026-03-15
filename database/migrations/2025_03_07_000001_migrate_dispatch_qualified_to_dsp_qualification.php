<?php

use App\Models\User;
use App\Models\Workgroup;
use App\Models\WorkgroupQualification;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Migrate dispatch_qualified to DSP qualification: ensure Dispatch workgroup has
     * a DSP qualification, then assign it to every user who currently has dispatch_qualified.
     */
    public function up(): void
    {
        $dispatch = Workgroup::whereRaw('LOWER(name) = ?', ['dispatch'])->first();
        if (! $dispatch) {
            return;
        }

        $dsp = WorkgroupQualification::firstOrCreate(
            ['workgroup_id' => $dispatch->id, 'code' => 'DSP'],
            ['label' => 'DSP', 'sort_order' => 99]
        );

        $userIds = DB::table('user_workgroups')
            ->where('workgroup_id', $dispatch->id)
            ->where('dispatch_qualified', true)
            ->pluck('user_id');

        foreach ($userIds as $userId) {
            DB::table('user_workgroup_qualifications')->insertOrIgnore([
                'user_id' => $userId,
                'workgroup_qualification_id' => $dsp->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Optionally remove DSP qualification assignments; we don't restore dispatch_qualified.
        $dispatch = Workgroup::whereRaw('LOWER(name) = ?', ['dispatch'])->first();
        if (! $dispatch) {
            return;
        }

        $dsp = WorkgroupQualification::where('workgroup_id', $dispatch->id)->where('code', 'DSP')->first();
        if ($dsp) {
            DB::table('user_workgroup_qualifications')->where('workgroup_qualification_id', $dsp->id)->delete();
        }
    }
};
