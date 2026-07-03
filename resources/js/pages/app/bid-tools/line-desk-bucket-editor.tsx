import { useMemo, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { deskBucketLabel } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';

export type LineDeskBucketOverride = {
    bid_line_id: number;
    bucket: string;
};

export function lineDeskBucketsFromStorage(
    raw: LineDeskBucketOverride[] | undefined,
): Record<number, string> {
    if (!raw?.length) {
        return {};
    }

    return Object.fromEntries(
        raw.map((entry) => [entry.bid_line_id, entry.bucket]),
    );
}

export function lineDeskBucketsToStorage(
    overrides: Record<number, string>,
): LineDeskBucketOverride[] {
    return Object.entries(overrides)
        .map(([lineId, bucket]) => ({
            bid_line_id: Number(lineId),
            bucket,
        }))
        .filter((entry) => entry.bid_line_id > 0 && entry.bucket !== '')
        .sort((a, b) => a.bid_line_id - b.bid_line_id);
}

export function effectiveLineDeskBucket(
    line: LinePickerRow,
    lineOverrides: Record<number, string>,
): string {
    if (lineOverrides[line.id]) {
        return lineOverrides[line.id];
    }

    return line.desk_bucket;
}

export function isLineDeskBucketManual(
    line: LinePickerRow,
    lineOverrides: Record<number, string>,
): boolean {
    return lineOverrides[line.id] !== undefined;
}

type DeskCatalogEntry = { key: string; label: string };

export function LineDeskBucketEditor({
    lines,
    deskCatalog,
    lineOverrides,
    onChange,
}: {
    lines: LinePickerRow[];
    deskCatalog: DeskCatalogEntry[];
    lineOverrides: Record<number, string>;
    onChange: (next: Record<number, string>) => void;
}) {
    const [showManualOnly, setShowManualOnly] = useState(false);

    const visibleLines = useMemo(
        () =>
            showManualOnly
                ? lines.filter((line) =>
                      isLineDeskBucketManual(line, lineOverrides),
                  )
                : lines,
        [lines, lineOverrides, showManualOnly],
    );

    const manualCount = useMemo(
        () =>
            lines.filter((line) => isLineDeskBucketManual(line, lineOverrides))
                .length,
        [lines, lineOverrides],
    );

    return (
        <div className="mt-4 space-y-2 border-t border-sidebar-border/50 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                    Line desk types
                </p>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={showManualOnly}
                        onChange={(e) => setShowManualOnly(e.target.checked)}
                    />
                    Manual only ({manualCount})
                </label>
            </div>
            <p className="text-xs text-muted-foreground">
                Set the desk type for each imported line. Defaults to
                auto-detected values; change any line individually.
            </p>
            <div className="max-h-72 overflow-auto rounded border border-sidebar-border/50">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                        <tr className="text-left">
                            <th className="px-2 py-1 font-medium">Line</th>
                            <th className="px-2 py-1 font-medium">Group</th>
                            <th className="px-2 py-1 font-medium">Start</th>
                            <th className="px-2 py-1 font-medium">Desk type</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleLines.map((line) => {
                            const effective = effectiveLineDeskBucket(
                                line,
                                lineOverrides,
                            );
                            const isManual = isLineDeskBucketManual(
                                line,
                                lineOverrides,
                            );
                            const autoBucket =
                                line.auto_desk_bucket ?? line.desk_bucket;

                            return (
                                <tr
                                    key={line.id}
                                    className="border-t border-sidebar-border/40"
                                >
                                    <td className="px-2 py-1 font-mono">
                                        {line.line_num}
                                    </td>
                                    <td className="px-2 py-1 font-mono">
                                        {line.desk_group || '—'}
                                    </td>
                                    <td className="px-2 py-1 font-mono text-muted-foreground">
                                        {line.start_time || '—'}
                                    </td>
                                    <td className="px-2 py-1">
                                        <Select
                                            value={effective}
                                            onValueChange={(value) => {
                                                const next = {
                                                    ...lineOverrides,
                                                };
                                                if (value === autoBucket) {
                                                    delete next[line.id];
                                                } else {
                                                    next[line.id] = value;
                                                }
                                                onChange(next);
                                            }}
                                        >
                                            <SelectTrigger className="h-7 w-full min-w-[8rem] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {deskCatalog.map((bucket) => (
                                                    <SelectItem
                                                        key={bucket.key}
                                                        value={bucket.key}
                                                    >
                                                        {bucket.label}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="unknown">
                                                    Unknown
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isManual && (
                                            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                                Auto:{' '}
                                                {deskBucketLabel(autoBucket)}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
