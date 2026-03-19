/**
 * CSRF token for Laravel (XSRF-TOKEN cookie).
 * Use for X-XSRF-TOKEN header on state-changing requests.
 */
export function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}
