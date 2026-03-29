<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Models\BidImport;
use App\Models\BidScenario;
use Inertia\Inertia;
use Inertia\Response;

class HubController extends Controller
{
    public function __invoke(): Response
    {
        $user = request()->user();
        $currentByYear = BidImport::query()
            ->where('is_current', true)
            ->orderBy('bid_year')
            ->get(['id', 'bid_year', 'file_hash', 'original_filename', 'title', 'created_at', 'meta']);

        $scenarios = BidScenario::query()
            ->where('user_id', $user->id)
            ->with('import:id,bid_year,is_current,file_hash')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(function (BidScenario $s) {
                $current = BidImport::query()
                    ->where('bid_year', $s->import->bid_year)
                    ->where('is_current', true)
                    ->first();

                return [
                    'id' => $s->id,
                    'name' => $s->name,
                    'bid_year' => $s->import->bid_year,
                    'import_stale' => ! $current || $current->id !== $s->bid_import_id,
                    'updated_at' => $s->updated_at->toIso8601String(),
                ];
            });

        return Inertia::render('app/bid-tools/index', [
            'currentImports' => $currentByYear->map(fn (BidImport $i) => [
                'id' => $i->id,
                'bid_year' => $i->bid_year,
                'file_hash' => $i->file_hash,
                'original_filename' => $i->original_filename,
                'title' => $i->title,
                'created_at' => $i->created_at->toIso8601String(),
                'distinct_codes_count' => count($i->meta['distinct_codes'] ?? []),
                'source_file_count' => ($c = count($i->meta['source_files'] ?? [])) > 0 ? $c : 1,
            ]),
            'scenarios' => $scenarios,
        ]);
    }
}
