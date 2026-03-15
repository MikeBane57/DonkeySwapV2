<?php

namespace Database\Seeders;

use App\Models\Workgroup;
use App\Models\WorkgroupPosition;
use App\Models\WorkgroupQualification;
use Illuminate\Database\Seeder;

class WorkgroupPositionsQualificationsSeeder extends Seeder
{
    public function run(): void
    {
        $dispatch = Workgroup::whereRaw('LOWER(name) = ?', ['dispatch'])->first();
        if ($dispatch) {
            $this->seedDispatch($dispatch);
        }

        $sod = Workgroup::whereRaw('LOWER(name) IN (?, ?)', ['sod', 'sods'])->first();
        if ($sod) {
            $this->seedSod($sod);
        }
    }

    private function seedDispatch(Workgroup $wg): void
    {
        WorkgroupPosition::where('workgroup_id', $wg->id)->delete();
        $positions = [];
        for ($i = 1; $i <= 130; $i++) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => (string) $i, 'type' => 'desk', 'sublocation_type' => null, 'sort_order' => count($positions)];
        }
        foreach (['Training', 'Testing', 'Special project', 'Custom'] as $label) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => $label, 'type' => 'extra', 'sublocation_type' => null, 'sort_order' => count($positions)];
        }
        foreach ($positions as $p) {
            WorkgroupPosition::create($p);
        }

        WorkgroupQualification::where('workgroup_id', $wg->id)->delete();
        foreach ([['DSP', 'DSP'], ['ETOPS', 'ETOPS'], ['INTL', 'INTL'], ['ASST', 'ASST']] as $i => $q) {
            WorkgroupQualification::create([
                'workgroup_id' => $wg->id,
                'code' => $q[0],
                'label' => $q[1],
                'sort_order' => $i,
            ]);
        }
    }

    private function seedSod(Workgroup $wg): void
    {
        WorkgroupPosition::where('workgroup_id', $wg->id)->delete();
        $positions = [];
        foreach (['G1', 'G2', 'G3', 'G4'] as $label) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => $label, 'type' => 'desk', 'sublocation_type' => 'regional', 'sort_order' => count($positions)];
        }
        foreach (['R1', 'R2', 'R3'] as $label) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => $label, 'type' => 'desk', 'sublocation_type' => 'nextday', 'sort_order' => count($positions)];
        }
        foreach (['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as $label) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => $label, 'type' => 'desk', 'sublocation_type' => 'sector', 'sort_order' => count($positions)];
        }
        foreach (['Disruption pod', 'Extra', 'Special project', 'Training'] as $label) {
            $positions[] = ['workgroup_id' => $wg->id, 'label' => $label, 'type' => 'extra', 'sublocation_type' => null, 'sort_order' => count($positions)];
        }
        foreach ($positions as $p) {
            WorkgroupPosition::create($p);
        }

        // SODs: placeholder for qualifications (none by default; admin can add in Workgroup Manager)
        if (WorkgroupQualification::where('workgroup_id', $wg->id)->doesntExist()) {
            // leave empty
        }
    }
}
