/**
 * CSRF token for Laravel (XSRF-TOKEN cookie).
 * Use for X-XSRF-TOKEN header on state-changing requests.
 */
export function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) {
        return decodeURIComponent(match[1]);
    }

    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta?.getAttribute('content') ?? '';
}
