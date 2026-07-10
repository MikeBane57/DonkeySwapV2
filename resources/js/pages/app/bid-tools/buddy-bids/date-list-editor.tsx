import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DatePickerPopover } from '@/components/date-picker-popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function DateListEditor({
    idPrefix,
    label,
    description,
    dates,
    bidYear,
    onChange,
}: {
    idPrefix: string;
    label: string;
    description: string;
    dates: string[];
    bidYear: number;
    onChange: (dates: string[]) => void;
}) {
    const [pickerValue, setPickerValue] = useState('');

    const addDate = (date: string) => {
        if (!date || dates.includes(date)) {
            setPickerValue('');
            return;
        }
        onChange([...dates, date].sort());
        setPickerValue('');
    };

    const removeDate = (date: string) => {
        onChange(dates.filter((d) => d !== date));
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-date-add`}>{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            <DatePickerPopover
                id={`${idPrefix}-date-add`}
                value={pickerValue}
                bidYear={bidYear}
                placeholder="Add date"
                onChange={addDate}
            />
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
                            <span className="font-mono">{date}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeDate(date)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
