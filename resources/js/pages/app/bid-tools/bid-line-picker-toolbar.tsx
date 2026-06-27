import { Button } from '@/components/ui/button';

export type LinePickerRow = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    start_shift: string;
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

    const amCount = lines.filter((l) => l.start_shift === 'am').length;
    const pmCount = lines.filter((l) => l.start_shift === 'pm').length;
    const midCount = lines.filter((l) => l.start_shift === 'mid').length;
    const reliefCount = lines.filter((l) => l.desk_bucket === 'RELIEF').length;

    return (
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={selectAll}>
                Select all
            </Button>
            {amCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectMatching((l) => l.start_shift === 'am')}
                >
                    AM ({amCount})
                </Button>
            )}
            {pmCount > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectMatching((l) => l.start_shift === 'pm')}
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
                        selectMatching((l) => l.start_shift === 'mid')
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
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
                Clear
            </Button>
        </div>
    );
}
