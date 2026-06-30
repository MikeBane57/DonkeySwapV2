import { Button } from '@/components/ui/button';
import { deskGroupShift } from '@/pages/app/bid-tools/desk-group-shift';
import type { DeskGroupShift } from '@/pages/app/bid-tools/desk-group-shift';

export type LinePickerRow = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    desk_shift: DeskGroupShift | null;
    desk_bucket: string;
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

    const amCount = lines.filter((l) => l.desk_shift === 'am').length;
    const pmCount = lines.filter((l) => l.desk_shift === 'pm').length;
    const midCount = lines.filter((l) => l.desk_shift === 'mid').length;
    const reliefCount = lines.filter((l) => l.desk_bucket === 'RELIEF').length;

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
            {amCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectMatching((l) => l.desk_shift === 'am')}
                >
                    AM ({amCount})
                </Button>
            )}
            {pmCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectMatching((l) => l.desk_shift === 'pm')}
                >
                    PM ({pmCount})
                </Button>
            )}
            {midCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        selectMatching((l) => l.desk_shift === 'mid')
                    }
                >
                    Mid ({midCount})
                </Button>
            )}
            {reliefCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        selectMatching((l) => l.desk_bucket === 'RELIEF')
                    }
                >
                    Relief ({reliefCount})
                </Button>
            )}
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
    desk_shift?: DeskGroupShift | string | null;
    desk_bucket?: string;
}): LinePickerRow {
    const shift =
        line.desk_shift === 'am' ||
        line.desk_shift === 'pm' ||
        line.desk_shift === 'mid'
            ? line.desk_shift
            : deskGroupShift(line.desk_group);

    return {
        id: line.id,
        line_num: line.line_num,
        desk_group: line.desk_group,
        start_time: line.start_time,
        desk_shift: shift,
        desk_bucket: line.desk_bucket ?? 'unknown',
    };
}
