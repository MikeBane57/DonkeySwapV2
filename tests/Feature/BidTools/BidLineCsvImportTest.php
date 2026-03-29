<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidYearRange;
use Illuminate\Http\UploadedFile;

function writeMinimalBidCsv(
    int $bidYear,
    string $lineNum = '1',
    string $group = 'DG',
): string {
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'bidcsv').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    $row = [$lineNum, $group, '0600', 'A'];
    foreach ($range->eachDate() as $d) {
        $row[] = 'x';
    }
    $row[] = '0';
    fputcsv($fh, $row);
    fclose($fh);

    return $path;
}

test('admin can upload bid csv and import lines', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $csvPath = writeMinimalBidCsv(2030);
    $upload = new UploadedFile($csvPath, 'lines.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2030,
            'files' => [$upload],
            'titles' => ['North'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    expect(BidImport::where('bid_year', 2030)->where('is_current', true)->exists())->toBeTrue();

    $line = BidLine::query()->where('line_num', '1')->first();
    expect($line)->not->toBeNull();
    expect($line->source_label)->toBe('North');

    @unlink($csvPath);
});

test('admin can merge multiple bid csvs for one bid year', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $pathA = writeMinimalBidCsv(2032, '1', 'DG-A');
    $pathB = writeMinimalBidCsv(2032, '1', 'DG-B');
    $upA = new UploadedFile($pathA, 'a.csv', 'text/csv', null, true);
    $upB = new UploadedFile($pathB, 'b.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2032,
            'batch_title' => 'Combined 2032',
            'files' => [$upA, $upB],
            'titles' => ['Workgroup A', 'Workgroup B'],
        ])
        ->assertRedirect(route('admin.bid-lines.index'));

    $imp = BidImport::where('bid_year', 2032)->where('is_current', true)->first();
    expect($imp)->not->toBeNull();
    expect($imp->title)->toBe('Combined 2032');
    expect(BidLine::query()->where('bid_import_id', $imp->id)->count())->toBe(2);

    expect(BidLine::query()->where('desk_group', 'DG-A')->value('source_label'))->toBe('Workgroup A');
    expect(BidLine::query()->where('desk_group', 'DG-B')->value('source_label'))->toBe('Workgroup B');

    @unlink($pathA);
    @unlink($pathB);
});

test('merged import rejects duplicate line number and group across files', function () {
    config(['features.bid_tools' => true]);

    $admin = User::factory()->create(['role' => 'admin']);
    $pathA = writeMinimalBidCsv(2033, '1', 'SAME');
    $pathB = writeMinimalBidCsv(2033, '1', 'SAME');
    $upA = new UploadedFile($pathA, 'a.csv', 'text/csv', null, true);
    $upB = new UploadedFile($pathB, 'b.csv', 'text/csv', null, true);

    $this->actingAs($admin)
        ->post('/app/admin/bid-lines', [
            'bid_year' => 2033,
            'files' => [$upA, $upB],
            'titles' => ['', ''],
        ])
        ->assertSessionHasErrors('files');

    @unlink($pathA);
    @unlink($pathB);
});

test('import service rejects csv with wrong date span', function () {
    $path = tempnam(sys_get_temp_dir(), 'bad').'.csv';
    $fh = fopen($path, 'wb');
    fputcsv($fh, ['Line Num', 'Group', 'Start Time', 'Rotation', '1-Feb-30', '2-Feb-30']);
    fputcsv($fh, ['1', 'DG', '0600', 'A', 'x', 'x']);
    fclose($fh);

    $user = User::factory()->create();
    $service = new BidLineCsvImportService;

    $service->importFromPath($path, 'bad.csv', $user->id, 2030);
})->throws(InvalidArgumentException::class);
