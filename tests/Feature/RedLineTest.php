<?php

use App\Models\ClassificationRedLine;
use App\Models\Workgroup;

test('red line position is stored per workgroup', function () {
    $wg = Workgroup::factory()->create(['name' => 'Dispatch']);
    $redLine = ClassificationRedLine::create([
        'workgroup_id' => $wg->id,
        'red_line_position' => 5,
    ]);

    expect($redLine->workgroup_id)->toBe($wg->id);
    expect($redLine->red_line_position)->toBe(5);
});

test('red line ordering: workgroup has one red line', function () {
    $wg = Workgroup::factory()->create();
    ClassificationRedLine::create(['workgroup_id' => $wg->id, 'red_line_position' => 3]);

    $redLines = $wg->redLines()->orderBy('red_line_position')->get();
    expect($redLines)->toHaveCount(1);
    expect($redLines->first()->red_line_position)->toBe(3);
});
