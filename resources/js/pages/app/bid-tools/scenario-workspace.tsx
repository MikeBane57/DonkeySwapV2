import { useMemo, useState } from 'react';
import { BidLinePicker } from '@/pages/app/bid-tools/bid-line-picker';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import { ScoredLinesTable } from '@/pages/app/bid-tools/scored-lines-table';
import type { ScoredLineRow } from '@/pages/app/bid-tools/scored-lines-table';
import { usePreviewScore } from '@/pages/app/bid-tools/use-preview-score';

export function ScenarioWorkspace({
    scenarioId,
    lines,
    draft,
    draftEnabled = true,
}: {
    scenarioId: number;
    lines: LinePickerRow[];
    draft: Record<string, unknown>;
    draftEnabled?: boolean;
}) {
    const [selected, setSelected] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {};
        lines.forEach((line) => {
            initial[line.id] = true;
        });
        return initial;
    });

    const selectedIds = useMemo(
        () =>
            Object.entries(selected)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selected],
    );

    const draftKey = useMemo(() => JSON.stringify(draft), [draft]);

    const { rows, loading, error } = usePreviewScore({
        scenarioId,
        lineIds: selectedIds,
        draft: JSON.parse(draftKey) as Record<string, unknown>,
        enabled: draftEnabled && selectedIds.length > 0,
    });

    return (
        <div className="space-y-3">
            <BidToolsCollapsibleSection
                title="Select lines"
                summary={`${selectedIds.length} selected`}
                defaultOpen
            >
                <BidLinePicker
                    lines={lines}
                    selected={selected}
                    onSelectedChange={setSelected}
                />
            </BidToolsCollapsibleSection>

            <BidToolsCollapsibleSection
                title="Recommended bid order"
                summary={
                    loading
                        ? 'Updating…'
                        : rows
                          ? `${rows.length} lines ranked`
                          : 'Select lines to rank'
                }
                defaultOpen
            >
                {error && <p className="text-sm text-destructive">{error}</p>}
                {loading && !rows && (
                    <p className="text-sm text-muted-foreground">
                        Scoring lines…
                    </p>
                )}
                <ScoredLinesTable
                    rows={(rows ?? []) as ScoredLineRow[]}
                    scenarioId={scenarioId}
                    compact
                />
            </BidToolsCollapsibleSection>
        </div>
    );
}
