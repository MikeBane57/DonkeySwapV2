import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

function parseYmdLocal(s: string): Date | undefined {
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

function formatYmdDisplay(s: string): string {
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

function dateToYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

type DatePickerPopoverProps = {
    value: string;
    onChange: (ymd: string) => void;
    className?: string;
    placeholder?: string;
    id?: string;
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
    'aria-label': ariaLabel,
}: DatePickerPopoverProps) {
    const [open, setOpen] = useState(false);
    const selected = parseYmdLocal(value);

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
                    defaultMonth={selected}
                    className="[--rdp-accent-background-color:color-mix(in_oklab,var(--primary)_15%,transparent)] [--rdp-accent-color:var(--primary)]"
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
