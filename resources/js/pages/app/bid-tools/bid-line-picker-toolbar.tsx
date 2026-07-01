import { Button } from '@/components/ui/button';

export type LinePickerRow = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    desk_bucket: string;
};

const DESK_BUCKET_LABELS: Record<string, string> = {
    DG7: 'DG 06/07',
    AG15: 'AG 14/15',
    DR7: 'DR 06/07',
    AR15: 'AR 14/15',
    DS7: 'DS 06/07',
    AS7: 'AS 14/15',
    MID: 'Mid',
    RELIEF: 'Relief',
};

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
        const order = Object.keys(DESK_BUCKET_LABELS);
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
                        {DESK_BUCKET_LABELS[bucket] ?? bucket} ({count})
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
