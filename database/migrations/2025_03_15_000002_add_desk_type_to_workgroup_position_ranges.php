<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const RANGE_TYPE_LABELS = [
        'domestic_dispatch' => 'Domestic dispatch',
        'assistant_desk' => 'Assistant desk',
        'etops' => 'ETOPS',
        'intl' => 'INTL',
        'regional' => 'Regional (G)',
        'sector' => 'Sector (S)',
        'nextday' => 'NextDay (R)',
        'extra' => 'Extra',
    ];

    public function up(): void
    {
        Schema::table('workgroup_position_ranges', function (Blueprint $table) {
            $table->foreignId('workgroup_desk_type_id')->nullable()->after('workgroup_id')->constrained('workgroup_desk_types')->nullOnDelete();
        });

        $this->backfillDeskTypesFromRangeType();

        Schema::table('workgroup_position_ranges', function (Blueprint $table) {
            $table->dropColumn('range_type');
        });
    }

    public function down(): void
    {
        Schema::table('workgroup_position_ranges', function (Blueprint $table) {
            $table->string('range_type', 30)->nullable()->after('parity');
        });

        $ranges = DB::table('workgroup_position_ranges')->whereNotNull('workgroup_desk_type_id')->get();
        foreach ($ranges as $r) {
            $deskType = DB::table('workgroup_desk_types')->where('id', $r->workgroup_desk_type_id)->first();
            if ($deskType) {
                DB::table('workgroup_position_ranges')->where('id', $r->id)->update(['range_type' => $deskType->code]);
            }
        }

        Schema::table('workgroup_position_ranges', function (Blueprint $table) {
            $table->dropForeign(['workgroup_desk_type_id']);
        });
    }

    private function backfillDeskTypesFromRangeType(): void
    {
        $ranges = DB::table('workgroup_position_ranges')->get();
        $deskTypeByWgAndCode = [];
        foreach ($ranges as $r) {
            $rangeType = $r->range_type ?? 'extra';
            $key = $r->workgroup_id.':'.$rangeType;
            if (! isset($deskTypeByWgAndCode[$key])) {
                $label = self::RANGE_TYPE_LABELS[$rangeType] ?? $rangeType;
                $qualId = $this->getQualificationIdForRangeType($r->workgroup_id, $rangeType);
                $id = DB::table('workgroup_desk_types')->insertGetId([
                    'workgroup_id' => $r->workgroup_id,
                    'code' => $rangeType,
                    'label' => $label,
                    'workgroup_qualification_id' => $qualId,
                    'sort_order' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $deskTypeByWgAndCode[$key] = $id;
            }
            DB::table('workgroup_position_ranges')->where('id', $r->id)->update([
                'workgroup_desk_type_id' => $deskTypeByWgAndCode[$key],
            ]);
        }
    }

    private function getQualificationIdForRangeType(int $workgroupId, string $rangeType): ?int
    {
        $codeMap = [
            'domestic_dispatch' => 'DSP',
            'assistant_desk' => 'ASST',
            'etops' => 'ETOPS',
            'intl' => 'INTL',
        ];
        $code = $codeMap[$rangeType] ?? null;
        if ($code === null) {
            return null;
        }
        $q = DB::table('workgroup_qualifications')->where('workgroup_id', $workgroupId)->where('code', $code)->first();

        return $q ? (int) $q->id : null;
    }
};
