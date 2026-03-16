<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AppIconController extends Controller
{
    private const DISK = 'public';

    private const DIRECTORY = 'app-icons';

    public function index(): Response
    {
        $currentIconUrl = Setting::appIconUrl();

        $icons = [];
        if (Storage::disk(self::DISK)->directoryExists(self::DIRECTORY)) {
            $files = Storage::disk(self::DISK)->files(self::DIRECTORY);
            foreach ($files as $path) {
                $mime = Storage::disk(self::DISK)->mimeType($path);
                if ($mime && Str::startsWith($mime, 'image/')) {
                    $url = '/storage/'.$path;
                    $icons[] = [
                        'url' => $url,
                        'filename' => basename($path),
                    ];
                }
            }
        }

        // Include default if not already in list
        $defaultUrl = config('app.icon_url', '/images/donkey-swap-logo.png');
        if ($defaultUrl && ! collect($icons)->contains('url', $defaultUrl)) {
            $icons[] = [
                'url' => $defaultUrl,
                'filename' => 'Default (config)',
            ];
        }

        return Inertia::render('admin/app-icon', [
            'icons' => $icons,
            'current_icon_url' => $currentIconUrl,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'icon' => ['required', 'file', 'image', 'max:2048'], // 2MB, image types
        ]);

        $file = $request->file('icon');
        $extension = $file->getClientOriginalExtension() ?: 'png';
        $safeExt = in_array(strtolower($extension), ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], true)
            ? strtolower($extension)
            : 'png';
        $filename = Str::random(16).'.'.$safeExt;

        Storage::disk(self::DISK)->makeDirectory(self::DIRECTORY);
        $path = $file->storeAs(self::DIRECTORY, $filename, ['disk' => self::DISK]);

        $url = '/storage/'.$path;
        Setting::set('app_icon_url', $url);

        return redirect()->route('admin.app-icon')->with('success', 'Icon uploaded and set as current.');
    }

    public function setCurrent(Request $request): RedirectResponse
    {
        $request->validate([
            'icon_url' => ['required', 'string', 'max:500'],
        ]);

        $url = $request->input('icon_url');
        $url = '/'.ltrim($url, '/');

        // Allow only our stored app-icons or the default config path
        $allowedPrefixes = ['/storage/app-icons/', '/images/'];
        $ok = false;
        foreach ($allowedPrefixes as $prefix) {
            if (Str::startsWith($url, $prefix)) {
                $ok = true;
                break;
            }
        }
        if (! $ok) {
            return redirect()->route('admin.app-icon')->with('error', 'Invalid icon URL.');
        }

        Setting::set('app_icon_url', $url);

        return redirect()->route('admin.app-icon')->with('success', 'App icon updated.');
    }
}
