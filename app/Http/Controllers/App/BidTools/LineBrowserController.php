<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\UpdateBidLineDeskGroupRequest;
use App\Models\BidImport;
use App\Models\BidLine;
use App\Services\BidTools\LineRowFormatter;
use Illuminate\Http\RedirectResponse;
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
                'desk_groups' => [],
                'years' => BidImport::query()->where('is_current', true)->pluck('bid_year')->sort()->values(),
            ]);
        }

        $lines = BidLine::query()
            ->where('bid_import_id', $import->id)
            ->with('import')
            ->orderBy('line_num')
            ->get();

        $deskGroups = BidLine::query()
            ->where('bid_import_id', $import->id)
            ->distinct()
            ->orderBy('desk_group')
            ->pluck('desk_group')
            ->values()
            ->all();

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
            'desk_groups' => $deskGroups,
            'years' => BidImport::query()->where('is_current', true)->pluck('bid_year')->sort()->values(),
        ]);
    }

    public function updateDeskGroup(
        UpdateBidLineDeskGroupRequest $request,
        int $line,
    ): RedirectResponse {
        $lineModel = BidLine::query()->with('import')->findOrFail($line);

        $deskGroup = trim($request->string('desk_group')->toString());
        $lineModel->desk_group = $deskGroup;
        $lineModel->save();

        return back();
    }
}
