/**
 * Central place for client-side error logging. Use in catch blocks so failures
 * are visible in DevTools; extend later (e.g. Sentry) without touching every file.
 */
export function logClientError(context: string, error: unknown): void {
    console.error(`[${context}]`, error);
}

/** True for timeouts, connection drops, and other failures where the server may be overloaded (avoid log spam). */
export function isLikelyTransientNetworkError(error: unknown): boolean {
    if (error == null) return false;
    if (typeof error === 'object') {
        const o = error as Record<string, unknown>;
        if (o.message === 'Network Error') return true;
        if (o.code === 'ECONNABORTED') return true;
        if (o.code === 'ERR_NETWORK') return true;
        if (typeof o.message === 'string' && o.message.toLowerCase().includes('timeout')) return true;
    }
    if (error instanceof Error) {
        if (error.name === 'AbortError') return true;
        if (error.message.includes('Failed to fetch')) return true;
    }
    return false;
}
