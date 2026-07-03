import { useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { deskBucketLabel } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import {
    bucketForMappedLine,
    deskMappingKey,
    updateDeskBucketMapping,
} from '@/pages/app/bid-tools/desk-bucket-mapping-utils';
import type {
    DeskBucketMapping,
    DeskBucketReferenceRow,
} from '@/pages/app/bid-tools/desk-bucket-mapping-utils';
import {
    LineDeskBucketEditor,
    lineDeskBucketsFromStorage,
    lineDeskBucketsToStorage,
} from '@/pages/app/bid-tools/line-desk-bucket-editor';

export function ImportFileMappingSection({
    deskCatalog,
    deskBucketReference,
    lines,
    deskBucketMappings,
    lineDeskBuckets,
    onDeskBucketMappingsChange,
    onLineDeskBucketsChange,
    defaultOpen = false,
}: {
    deskCatalog: { key: string; label: string }[];
    deskBucketReference: DeskBucketReferenceRow[];
    lines: LinePickerRow[];
    deskBucketMappings: DeskBucketMapping[];
    lineDeskBuckets: Record<number, string>;
    onDeskBucketMappingsChange: (mappings: DeskBucketMapping[]) => void;
    onLineDeskBucketsChange: (overrides: Record<number, string>) => void;
    defaultOpen?: boolean;
}) {
    const deskBucketReferenceByKey = useMemo(
        () =>
            Object.fromEntries(
                deskBucketReference.map((row) => [
                    deskMappingKey(row.desk_group, row.start_time),
                    row,
                ]),
            ) as Record<string, DeskBucketReferenceRow>,
        [deskBucketReference],
    );

    const groupMappedLines = useMemo(
        () =>
            lines.map((line) => ({
                ...line,
                desk_bucket: bucketForMappedLine(
                    line,
                    deskBucketMappings,
                    deskBucketReferenceByKey,
                ),
            })),
        [lines, deskBucketMappings, deskBucketReferenceByKey],
    );

    const manualCount = deskBucketMappings.length;
    const lineOverrideCount = Object.keys(lineDeskBuckets).length;

    return (
        <BidToolsCollapsibleSection
            title="Import file mapping"
            summary={`${deskCatalog.length} bucket types · ${manualCount} group overrides · ${lineOverrideCount} line overrides`}
            defaultOpen={defaultOpen}
        >
            <p className="text-xs text-muted-foreground">
                Applies to every bidder in this simulation. Map desk groups and
                start times from your import file to the correct bucket when
                auto-detection is wrong.
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div>
                    <p className="mb-2 text-xs font-medium text-foreground">
                        All bucket types
                    </p>
                    <ul className="space-y-1 text-xs">
                        {deskCatalog.map((d) => (
                            <li
                                key={d.key}
                                className="flex justify-between gap-2 rounded border border-sidebar-border/50 px-2 py-1"
                            >
                                <span className="font-mono">{d.key}</span>
                                <span className="text-muted-foreground">
                                    {d.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className="mb-2 text-xs font-medium text-foreground">
                        Group / start-time mapping
                    </p>
                    <div className="max-h-64 overflow-auto rounded border border-sidebar-border/50">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted/80">
                                <tr className="text-left">
                                    <th className="px-2 py-1 font-medium">
                                        Group
                                    </th>
                                    <th className="px-2 py-1 font-medium">
                                        Start
                                    </th>
                                    <th className="px-2 py-1 font-medium">
                                        Bucket
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                        Lines
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {deskBucketReference.map((row) => {
                                    const rowKey = deskMappingKey(
                                        row.desk_group,
                                        row.start_time,
                                    );
                                    const effectiveBucket = bucketForMappedLine(
                                        {
                                            desk_group: row.desk_group,
                                            start_time: row.start_time,
                                            desk_bucket: row.desk_bucket,
                                        } as LinePickerRow,
                                        deskBucketMappings,
                                        deskBucketReferenceByKey,
                                    );
                                    const isManual =
                                        effectiveBucket !== row.auto_bucket;

                                    return (
                                        <tr
                                            key={rowKey}
                                            className="border-t border-sidebar-border/40"
                                        >
                                            <td className="px-2 py-1 font-mono">
                                                {row.desk_group || '—'}
                                            </td>
                                            <td className="px-2 py-1 font-mono text-muted-foreground">
                                                {row.start_time || '—'}
                                            </td>
                                            <td className="px-2 py-1">
                                                <Select
                                                    value={effectiveBucket}
                                                    onValueChange={(value) => {
                                                        onDeskBucketMappingsChange(
                                                            updateDeskBucketMapping(
                                                                deskBucketMappings,
                                                                row.desk_group,
                                                                row.start_time,
                                                                row.auto_bucket,
                                                                value,
                                                            ),
                                                        );
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 w-full min-w-[8rem] text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {deskCatalog.map(
                                                            (bucket) => (
                                                                <SelectItem
                                                                    key={
                                                                        bucket.key
                                                                    }
                                                                    value={
                                                                        bucket.key
                                                                    }
                                                                >
                                                                    {
                                                                        bucket.label
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                        <SelectItem value="unknown">
                                                            Unknown
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {isManual && (
                                                    <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                                        Auto:{' '}
                                                        {deskBucketLabel(
                                                            row.auto_bucket,
                                                        )}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-2 py-1 text-right tabular-nums">
                                                {row.line_count}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <LineDeskBucketEditor
                lines={groupMappedLines}
                deskCatalog={deskCatalog}
                lineOverrides={lineDeskBuckets}
                onChange={onLineDeskBucketsChange}
            />
        </BidToolsCollapsibleSection>
    );
}

export { lineDeskBucketsFromStorage, lineDeskBucketsToStorage };
