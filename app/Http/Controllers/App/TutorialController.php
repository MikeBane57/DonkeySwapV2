<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TutorialController extends Controller
{
    /**
     * Merge feature ids into the user's seen list (What's new, skipped tours, etc.).
     */
    public function markSeen(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'feature_ids' => ['required', 'array'],
            'feature_ids.*' => ['string', 'max:128'],
        ]);

        $request->user()->markTutorialFeaturesSeen($validated['feature_ids']);

        return back();
    }
}
