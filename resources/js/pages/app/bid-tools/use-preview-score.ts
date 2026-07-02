import { useEffect, useRef, useState } from 'react';
import { logClientError } from '@/lib/client-logger';
import { getCsrfToken } from '@/lib/csrf';
import type { ScoredLineRow } from '@/pages/app/bid-tools/scored-lines-table';
import type { SortExplanation } from '@/pages/app/bid-tools/ranking-rules-explanation';

type PreviewDraft = Record<string, unknown>;

export function usePreviewScore({
    scenarioId,
    lineIds,
    draft,
    enabled = true,
    debounceMs = 600,
}: {
    scenarioId: number;
    lineIds: number[];
    draft: PreviewDraft;
    enabled?: boolean;
    debounceMs?: number;
}) {
    const [rows, setRows] = useState<ScoredLineRow[] | null>(null);
    const [sortExplanation, setSortExplanation] =
        useState<SortExplanation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    useEffect(() => {
        if (!enabled || lineIds.length === 0) {
            setRows(null);
            setSortExplanation(null);
            setLoading(false);
            setError(null);
            return;
        }

        const currentRequest = ++requestId.current;
        setLoading(true);
        setError(null);

        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/bid-tools/scenarios/${scenarioId}/preview-score`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            line_ids: lineIds,
                            draft,
                        }),
                    },
                );

                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as {
                        message?: string;
                        errors?: Record<string, string[]>;
                    } | null;
                    const message =
                        body?.message ??
                        Object.values(body?.errors ?? {})
                            .flat()
                            .join(' ') ??
                        'Could not score lines.';
                    throw new Error(message);
                }

                const data = (await res.json()) as {
                    scored_rows: ScoredLineRow[];
                    sort_explanation: SortExplanation | null;
                };

                if (currentRequest === requestId.current) {
                    setRows(data.scored_rows);
                    setSortExplanation(data.sort_explanation ?? null);
                    setLoading(false);
                }
            } catch (e) {
                logClientError('bid-tools.preview-score', e);
                if (currentRequest === requestId.current) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : 'Could not score lines.',
                    );
                    setLoading(false);
                }
            }
        }, debounceMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [scenarioId, lineIds, draft, enabled, debounceMs]);

    return { rows, sortExplanation, loading, error };
}
