<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Models\BidImport;
use App\Models\BidLine;
use App\Services\BidTools\LineRowFormatter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LineBrowserController extends Controller
{
    public function __construct(
        private readonly LineRowFormatter $rowFormatter,
    ) {}

    public function __invoke(Request $request): Response
    {
        $bidYear = (int) $request->query('bid_year', 0);
        $import = $bidYear > 0
            ? BidImport::query()->where('bid_year', $bidYear)->where('is_current', true)->first()
            : BidImport::query()->where('is_current', true)->orderByDesc('bid_year')->first();

        if (! $import) {
            return Inertia::render('app/bid-tools/lines', [
                'import' => null,
                'lines' => [],
                'years' => BidImport::query()->where('is_current', true)->pluck('bid_year')->sort()->values(),
            ]);
        }

        $lines = BidLine::query()
            ->where('bid_import_id', $import->id)
            ->with('import')
            ->orderBy('line_num')
            ->get();

        $rows = [];
        foreach ($lines as $line) {
            $rows[] = $this->rowFormatter->format($line);
        }

        return Inertia::render('app/bid-tools/lines', [
            'import' => [
                'id' => $import->id,
                'bid_year' => $import->bid_year,
                'file_hash' => $import->file_hash,
            ],
            'lines' => $rows,
            'years' => BidImport::query()->where('is_current', true)->pluck('bid_year')->sort()->values(),
        ]);
    }
}
