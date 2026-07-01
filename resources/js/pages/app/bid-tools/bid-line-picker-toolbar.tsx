import { Button } from '@/components/ui/button';

export type LinePickerRow = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    desk_bucket: string;
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

    const buckets = Object.keys(bucketCounts).sort((a, b) => {
        const order = [
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
        const aRank = order.indexOf(a);
        const bRank = order.indexOf(b);
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

    return (
        <div className="flex flex-wrap gap-2">
            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={selectAll}
            >
                Select all
            </Button>
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
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                Clear
            </Button>
        </div>
    );
}

export function mapLineToPickerRow(line: {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    desk_bucket?: string;
}): LinePickerRow {
    return {
        id: line.id,
        line_num: line.line_num,
        desk_group: line.desk_group,
        start_time: line.start_time,
        desk_bucket: line.desk_bucket ?? 'unknown',
    };
}
