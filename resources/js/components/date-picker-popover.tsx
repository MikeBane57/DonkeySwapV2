import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

export function parseYmdLocal(s: string): Date | undefined {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return undefined;
    }
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== m - 1 ||
        dt.getDate() !== d
    ) {
        return undefined;
    }
    return dt;
}

export function formatYmdDisplay(s: string): string {
    const d = parseYmdLocal(s);
    if (!d) {
        return '';
    }
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function dateToYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function calendarBoundsForYear(bidYear?: number) {
    const anchorYear = bidYear ?? new Date().getFullYear();

    return {
        startMonth: new Date(anchorYear - 1, 0, 1),
        endMonth: new Date(anchorYear + 2, 11, 1),
        defaultMonth: new Date(anchorYear, 0, 1),
    };
}

function resolveDefaultMonth(
    bidYear: number | undefined,
    ...dates: Array<Date | undefined>
): Date {
    for (const date of dates) {
        if (date) {
            return date;
        }
    }

    return calendarBoundsForYear(bidYear).defaultMonth;
}

const dayPickerClassName =
    '[--rdp-accent-background-color:color-mix(in_oklab,var(--primary)_15%,transparent)] [--rdp-accent-color:var(--primary)]';

type DatePickerPopoverProps = {
    value: string;
    onChange: (ymd: string) => void;
    className?: string;
    placeholder?: string;
    id?: string;
    bidYear?: number;
    'aria-label'?: string;
};

/**
 * Calendar grid in a popover (react-day-picker). Stores YYYY-MM-DD in local calendar terms.
 */
export function DatePickerPopover({
    value,
    onChange,
    className,
    placeholder = 'Pick date',
    id,
    bidYear,
    'aria-label': ariaLabel,
}: DatePickerPopoverProps) {
    const [open, setOpen] = useState(false);
    const selected = parseYmdLocal(value);
    const bounds = useMemo(() => calendarBoundsForYear(bidYear), [bidYear]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    className={cn(
                        'h-8 justify-start px-2 text-left text-sm font-normal',
                        !value && 'text-muted-foreground',
                        className,
                    )}
                    aria-label={ariaLabel}
                >
                    <CalendarDays className="mr-1.5 size-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 truncate">
                        {value ? formatYmdDisplay(value) : placeholder}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[100] w-auto border-0 p-2 shadow-lg"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DayPicker
                    mode="single"
                    selected={selected}
                    defaultMonth={resolveDefaultMonth(bidYear, selected)}
                    startMonth={bounds.startMonth}
                    endMonth={bounds.endMonth}
                    captionLayout="dropdown"
                    reverseYears
                    className={dayPickerClassName}
                    onSelect={(date) => {
                        if (date) {
                            onChange(dateToYmd(date));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

type DateRangePickerPopoverProps = {
    start: string;
    end: string;
    onChange: (start: string, end: string) => void;
    className?: string;
    placeholder?: string;
    bidYear?: number;
    'aria-label'?: string;
};

function formatRangeDisplay(start: string, end: string): string {
    if (start && end) {
        if (start === end) {
            return formatYmdDisplay(start);
        }

        return `${formatYmdDisplay(start)} – ${formatYmdDisplay(end)}`;
    }

    if (start) {
        return `${formatYmdDisplay(start)} – …`;
    }

    return '';
}

function rangeFromYmd(start: string, end: string): DateRange | undefined {
    const from = parseYmdLocal(start);
    if (!from) {
        return undefined;
    }

    const to = parseYmdLocal(end);

    return { from, to: to ?? from };
}

/**
 * Calendar range picker in a popover. Click start date, then end date on the grid.
 */
export function DateRangePickerPopover({
    start,
    end,
    onChange,
    className,
    placeholder = 'Pick date range',
    bidYear,
    'aria-label': ariaLabel,
}: DateRangePickerPopoverProps) {
    const [open, setOpen] = useState(false);
    const selected = rangeFromYmd(start, end);
    const bounds = useMemo(() => calendarBoundsForYear(bidYear), [bidYear]);
    const display = formatRangeDisplay(start, end);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        'h-8 min-w-[12rem] justify-start px-2 text-left text-sm font-normal',
                        !display && 'text-muted-foreground',
                        className,
                    )}
                    aria-label={ariaLabel}
                >
                    <CalendarDays className="mr-1.5 size-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 truncate">
                        {display || placeholder}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[100] w-auto border-0 p-2 shadow-lg"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                    Click a start date, then an end date.
                </p>
                <DayPicker
                    mode="range"
                    selected={selected}
                    defaultMonth={resolveDefaultMonth(
                        bidYear,
                        selected?.from,
                        selected?.to,
                    )}
                    startMonth={bounds.startMonth}
                    endMonth={bounds.endMonth}
                    captionLayout="dropdown"
                    reverseYears
                    className={dayPickerClassName}
                    onSelect={(range) => {
                        if (!range?.from) {
                            return;
                        }

                        const nextStart = dateToYmd(range.from);
                        const nextEnd = range.to
                            ? dateToYmd(range.to)
                            : nextStart;
                        onChange(nextStart, nextEnd);

                        if (range.to) {
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
