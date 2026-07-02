import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type LinePickerRow = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    auto_desk_bucket?: string;
    desk_bucket: string;
    is_manual_desk_bucket?: boolean;
};

const DESK_BUCKET_LABELS: Record<string, string> = {
    DS: 'DS',
    DG: 'DG',
    DS7: 'DS7',
    DR: 'DR',
    DS_DR_MIX: 'DS/DR Mix',
    AG: 'AG',
    AS: 'AS',
    AS15: 'AS15',
    AR: 'AR',
    AS_AR_MIX: 'AS/AR Mix',
    MID: 'Mid',
    RELIEF: 'Relief',
    DG7: 'DG',
    AG15: 'AG',
    DR7: 'DR',
    AR15: 'AR',
};

export function deskBucketLabel(bucket: string): string {
    return DESK_BUCKET_LABELS[bucket] ?? bucket;
}

const BUCKET_ORDER = [
    'DS',
    'DG',
    'DS7',
    'DR',
    'DS_DR_MIX',
    'AG',
    'AS',
    'AS15',
    'AR',
    'AS_AR_MIX',
    'MID',
    'RELIEF',
];

function sortBuckets(buckets: string[]): string[] {
    return [...buckets].sort((a, b) => {
        const aRank = BUCKET_ORDER.indexOf(a);
        const bRank = BUCKET_ORDER.indexOf(b);
        if (aRank === -1 && bRank === -1) {
            return a.localeCompare(b);
        }
        if (aRank === -1) {
            return 1;
        }
        if (bRank === -1) {
            return -1;
        }

        return aRank - bRank;
    });
}

export function BidLinePickerToolbar({
    lines,
    onSelect,
    onClear,
}: {
    lines: LinePickerRow[];
    onSelect: (ids: number[]) => void;
    onClear: () => void;
}) {
    const selectAll = () => onSelect(lines.map((l) => l.id));

    const selectMatching = (predicate: (line: LinePickerRow) => boolean) => {
        const ids = lines.filter(predicate).map((l) => l.id);
        if (ids.length > 0) {
            onSelect(ids);
        }
    };

    const bucketCounts = lines.reduce<Record<string, number>>((acc, line) => {
        const bucket = line.desk_bucket || 'unknown';
        acc[bucket] = (acc[bucket] ?? 0) + 1;

        return acc;
    }, {});

    const buckets = sortBuckets(Object.keys(bucketCounts));

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={selectAll}
                >
                    Select all
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                >
                    Clear
                </Button>
            </div>

            <div className="md:hidden">
                <Select
                    onValueChange={(bucket) =>
                        selectMatching((l) => l.desk_bucket === bucket)
                    }
                >
                    <SelectTrigger className="h-9 w-full text-sm">
                        <SelectValue placeholder="Select by desk bucket…" />
                    </SelectTrigger>
                    <SelectContent>
                        {buckets.map((bucket) => {
                            const count = bucketCounts[bucket] ?? 0;
                            if (count === 0) {
                                return null;
                            }

                            return (
                                <SelectItem key={bucket} value={bucket}>
                                    {deskBucketLabel(bucket)} ({count})
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>

            <div className="hidden flex-wrap gap-2 md:flex">
                {buckets.map((bucket) => {
                    const count = bucketCounts[bucket] ?? 0;
                    if (count === 0) {
                        return null;
                    }

                    return (
                        <Button
                            key={bucket}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                selectMatching((l) => l.desk_bucket === bucket)
                            }
                        >
                            {deskBucketLabel(bucket)} ({count})
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

export function mapLineToPickerRow(line: {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    auto_desk_bucket?: string;
    desk_bucket?: string;
    is_manual_desk_bucket?: boolean;
}): LinePickerRow {
    return {
        id: line.id,
        line_num: line.line_num,
        desk_group: line.desk_group,
        start_time: line.start_time,
        auto_desk_bucket: line.auto_desk_bucket,
        desk_bucket: line.desk_bucket ?? 'unknown',
        is_manual_desk_bucket: line.is_manual_desk_bucket,
    };
}
