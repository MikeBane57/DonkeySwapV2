import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
    BidLinePickerToolbar,
    type LinePickerRow,
} from '@/pages/app/bid-tools/bid-line-picker-toolbar';

export type { LinePickerRow };

export function BidLinePicker({
    lines,
    selected,
    onSelectedChange,
}: {
    lines: LinePickerRow[];
    selected: Record<number, boolean>;
    onSelectedChange: (next: Record<number, boolean>) => void;
}) {
    const selectedIds = useMemo(
        () =>
            Object.entries(selected)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selected],
    );

    const selectLineIds = (ids: number[]) => {
        onSelectedChange(
            ids.reduce<Record<number, boolean>>((acc, id) => {
                acc[id] = true;
                return acc;
            }, { ...selected }),
        );
    };

    const clearSelection = () => onSelectedChange({});

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <BidLinePickerToolbar
                    lines={lines}
                    onSelect={selectLineIds}
                    onClear={clearSelection}
                />
                <span className="text-xs text-muted-foreground">
                    {selectedIds.length} of {lines.length} selected
                </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-sidebar-border/60 p-2">
                <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {lines.map((line) => (
                        <label
                            key={line.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted/40"
                        >
                            <Checkbox
                                checked={!!selected[line.id]}
                                onCheckedChange={(checked) =>
                                    onSelectedChange({
                                        ...selected,
                                        [line.id]: checked === true,
                                    })
                                }
                            />
                            <span className="font-mono">{line.line_num}</span>
                            <span className="truncate text-muted-foreground">
                                {line.desk_group}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
