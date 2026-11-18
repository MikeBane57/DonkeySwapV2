import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
    DatePickerPopover,
    DateRangePickerPopover,
    expandYmdRange,
} from '@/components/date-picker-popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function mergeSortedUniqueDates(
    existing: string[],
    toAdd: string[],
): string[] {
    return [...new Set([...existing, ...toAdd])].sort();
}

export function DateListEditor({
    idPrefix,
    label,
    description,
    dates,
    bidYear,
    onChange,
    transferAction,
}: {
    idPrefix: string;
    label: string;
    description: string;
    dates: string[];
    bidYear: number;
    onChange: (dates: string[]) => void;
    transferAction?: {
        label: string;
        ariaLabel: string;
        onTransfer: (date: string) => void;
    };
}) {
    const [pickerValue, setPickerValue] = useState('');

    const addDate = (date: string) => {
        if (!date || dates.includes(date)) {
            setPickerValue('');
            return;
        }
        onChange(mergeSortedUniqueDates(dates, [date]));
        setPickerValue('');
    };

    const addRange = (start: string, end: string) => {
        const expanded = expandYmdRange(start, end);
        if (expanded.length === 0) {
            return;
        }
        onChange(mergeSortedUniqueDates(dates, expanded));
    };

    const removeDate = (date: string) => {
        onChange(dates.filter((d) => d !== date));
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-range-add`}>{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <DateRangePickerPopover
                    start=""
                    end=""
                    bidYear={bidYear}
                    placeholder="Add date range"
                    aria-label={`${label} range`}
                    className="w-full sm:w-auto"
                    onAdd={addRange}
                />
                <DatePickerPopover
                    id={`${idPrefix}-date-add`}
                    value={pickerValue}
                    bidYear={bidYear}
                    placeholder="Or one day"
                    aria-label={`${label} single day`}
                    className="w-full sm:w-auto"
                    onChange={addDate}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {dates.length} date{dates.length === 1 ? '' : 's'}
            </p>
            {dates.length > 0 && (
                <ul className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-sidebar-border/60 p-2">
                    {dates.map((date) => (
                        <li
                            key={date}
                            className="flex items-center justify-between gap-2 text-xs"
                        >
                            <span className="min-w-0 truncate font-mono">
                                {date}
                            </span>
                            <div className="flex shrink-0 items-center gap-0.5">
                                {transferAction && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-1.5 text-[10px]"
                                        aria-label={`${transferAction.ariaLabel} ${date}`}
                                        onClick={() =>
                                            transferAction.onTransfer(date)
                                        }
                                    >
                                        {transferAction.label}
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    aria-label={`Remove ${date}`}
                                    onClick={() => removeDate(date)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
