<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreBidLineImportRequest;
use App\Models\BidImport;
use App\Services\BidTools\BidLineCsvImportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class BidLineImportController extends Controller
{
    public function index(): Response
    {
        $imports = BidImport::query()
            ->with('uploadedBy:id,name')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (BidImport $i) => [
                'id' => $i->id,
                'bid_year' => $i->bid_year,
                'is_current' => $i->is_current,
                'file_hash' => $i->file_hash,
                'original_filename' => $i->original_filename,
                'title' => $i->title,
                'created_at' => $i->created_at->toIso8601String(),
                'uploaded_by_name' => $i->uploadedBy?->name,
                'line_count' => $i->lines()->count(),
                'source_files' => $i->meta['source_files'] ?? null,
            ]);

        return Inertia::render('admin/bid-line-import', [
            'imports' => $imports,
        ]);
    }

    public function store(StoreBidLineImportRequest $request, BidLineCsvImportService $importer): RedirectResponse
    {
        /** @var array<int, UploadedFile> $files */
        $files = $request->file('files', []);
        if (! is_array($files)) {
            $files = array_filter([$files]);
        }
        /** @var list<string|null> $titles */
        $titles = $request->input('titles', []);
        $batchTitle = $request->validated('batch_title');
        if (is_string($batchTitle)) {
            $batchTitle = trim($batchTitle);
            if ($batchTitle === '') {
                $batchTitle = null;
            }
        } else {
            $batchTitle = null;
        }

        $sources = [];
        $storedPaths = [];

        try {
            foreach ($files as $idx => $file) {
                $path = $file->store('bid-imports', 'local');
                $storedPaths[] = $path;
                $full = Storage::disk('local')->path($path);
                $label = isset($titles[$idx]) ? trim((string) $titles[$idx]) : '';
                $sources[] = [
                    'path' => $full,
                    'original_filename' => $file->getClientOriginalName(),
                    'source_label' => $label !== '' ? $label : null,
                ];
            }

            $result = $importer->importFromSources(
                $sources,
                (int) $request->user()->id,
                (int) $request->validated('bid_year'),
                $batchTitle,
            );
        } catch (InvalidArgumentException|RuntimeException $e) {
            foreach ($storedPaths as $p) {
                Storage::disk('local')->delete($p);
            }

            return redirect()
                ->back()
                ->withErrors(['files' => $e->getMessage()]);
        } catch (Throwable $e) {
            foreach ($storedPaths as $p) {
                Storage::disk('local')->delete($p);
            }
            throw $e;
        }

        foreach ($storedPaths as $p) {
            Storage::disk('local')->delete($p);
        }

        $n = count($files);
        $msg = $n > 1
            ? 'Imported '.$result['line_count'].' lines from '.$n.' files (hash '.$result['import']->file_hash.').'
            : 'Imported '.$result['line_count'].' lines (hash '.$result['import']->file_hash.').';

        return redirect()
            ->route('admin.bid-lines.index')
            ->with('success', $msg);
    }
}
