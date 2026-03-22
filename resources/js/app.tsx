import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import { ErrorBoundary } from '@/components/error-boundary';
import { initializeTheme } from '@/hooks/use-appearance';
import { isLikelyTransientNetworkError } from '@/lib/client-logger';

function getAppDisplayName(): string {
    if (typeof window !== 'undefined') {
        const w = window as Window & { __APP_NAME__?: string };
        const n = w.__APP_NAME__;
        if (typeof n === 'string' && n.trim() !== '') {
            return n.trim();
        }
    }
    return import.meta.env.VITE_APP_NAME || 'Donkey Swap';
}

const appName = getAppDisplayName();

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <StrictMode>
                <ErrorBoundary>
                    <App {...props} />
                </ErrorBoundary>
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// Avoid "Uncaught (in promise) AxiosError" when the host times out or resets the connection.
document.addEventListener('inertia:exception', (event) => {
    const detail = (event as CustomEvent<{ exception?: unknown }>).detail;
    if (detail?.exception && isLikelyTransientNetworkError(detail.exception)) {
        event.preventDefault();
    }
});

// This will set light / dark mode on load...
initializeTheme();
