<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidYearRange;

function writeMultiLineBidCsv(int $bidYear, int $lineCount): string
{
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'bidcsv').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    for ($i = 1; $i <= $lineCount; $i++) {
        $row = [(string) (550 + $i), 'DG', '0600', 'A'];
        foreach ($range->eachDate() as $d) {
            $row[] = 'x';
        }
        $row[] = '0';
        fputcsv($fh, $row);
    }
    fclose($fh);

    return $path;
}

test('comparing many bid lines stores slim scores in session', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 60);

    $result = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Test import',
    );
    $import = $result['import'];

    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Compare test',
        'vacation_bank' => 10,
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->pluck('id')
        ->all();

    expect($lineIds)->toHaveCount(60);

    $response = $this->actingAs($user)->post(
        route('bid-tools.scenarios.score', $scenario->id),
        ['line_ids' => $lineIds],
    );

    $response->assertRedirect(route('bid-tools.scenarios.ranked', $scenario->id));

    $stored = session('bid_scores.scenario.'.$scenario->id);
    expect($stored)->toBeArray()->toHaveCount(60);

    foreach ($stored as $row) {
        expect($row)->toHaveKeys(['bid_line_id', 'line_num', 'total', 'parts']);
        expect($row)->not->toHaveKey('breakdown');
    }

    $this->actingAs($user)
        ->get(route('bid-tools.scenarios.ranked', $scenario->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/scenarios/ranked')
            ->has('scored_rows', 60)
            ->where('scored_rows.0.rank', 1));
});
