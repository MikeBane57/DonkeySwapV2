<?php

use App\Services\BidTools\DeskGroupShiftClassifier;

it('classifies desk groups by first letter', function () {
    $classifier = new DeskGroupShiftClassifier;

    expect($classifier->shiftForDeskGroup('D1'))->toBe('am');
    expect($classifier->shiftForDeskGroup('d2'))->toBe('am');
    expect($classifier->shiftForDeskGroup('A1'))->toBe('pm');
    expect($classifier->shiftForDeskGroup('AM/PM MIX'))->toBe('pm');
    expect($classifier->shiftForDeskGroup('M1'))->toBe('mid');
    expect($classifier->shiftForDeskGroup(''))->toBeNull();
});
