function getDisplayMode(): string {
    if (typeof window === 'undefined') {
        return 'unknown';
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) {
        return 'standalone';
    }
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return 'standalone';
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
        return 'minimal-ui';
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
        return 'fullscreen';
    }

    return 'browser';
}

function getTelemetry(): { displayMode: string; platform: string } {
    const displayMode = getDisplayMode();
    let platform = '';
    if (typeof navigator !== 'undefined') {
        const uaData = (
            navigator as Navigator & { userAgentData?: { platform?: string } }
        ).userAgentData;
        platform = uaData?.platform?.trim() ?? '';
        if (platform === '') {
            platform = navigator.platform?.trim() ?? '';
        }
    }
    if (platform.length > 64) {
        platform = platform.slice(0, 64);
    }

    return { displayMode, platform };
}

function setTelemetryCookie(): void {
    const t = getTelemetry();
    const value = encodeURIComponent(
        JSON.stringify({ dm: t.displayMode, pf: t.platform }),
    );
    document.cookie = `ds_client_ctx=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Sends display-mode (browser vs installed PWA) and platform hints on Inertia visits,
 * and sets a small cookie so the first full page load can still be attributed after JS runs.
 */
export function initClientSessionTelemetry(): void {
    if (typeof document === 'undefined') {
        return;
    }

    setTelemetryCookie();

    document.addEventListener(
        'inertia:before',
        (event: Event) => {
            const detail = (
                event as CustomEvent<{
                    visit?: { headers?: Record<string, string> };
                }>
            ).detail;
            const visit = detail?.visit;
            if (!visit?.headers) {
                return;
            }
            const t = getTelemetry();
            visit.headers['X-Client-Display-Mode'] = t.displayMode;
            visit.headers['X-Client-Platform'] = t.platform;
        },
        false,
    );
}
