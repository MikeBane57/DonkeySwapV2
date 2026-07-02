import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MobileReorderButtons } from '@/pages/app/bid-tools/preference-rank-shared';

export type Priority = 'ignore' | 'low' | 'high';

export type PersonalDateEntry = {
    date?: string;
    starts_on?: string;
    ends_on?: string;
    label: string;
    priority: Priority;
};

const dateInputClass =
    'h-8 w-full text-xs [color-scheme:dark] sm:w-[9.5rem]';

function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const n = [...list];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);

    return n;
}

function isRangeEntry(entry: PersonalDateEntry): boolean {
    return Boolean(entry.starts_on && entry.ends_on);
}

function entryKey(entry: PersonalDateEntry, index: number): string {
    if (isRangeEntry(entry)) {
        return `range-${entry.starts_on}-${entry.ends_on}-${index}`;
    }

    return `date-${entry.date ?? ''}-${index}`;
}

function PrioritySelect({
    value,
    onChange,
}: {
    value: Priority;
    onChange: (p: Priority) => void;
}) {
    return (
        <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
            <SelectTrigger className="h-8 w-[7.5rem] text-xs">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="ignore">Don&apos;t care</SelectItem>
            </SelectContent>
        </Select>
    );
}

function DraggableRow({
    index,
    listLength,
    onReorder,
    children,
}: {
    index: number;
    listLength: number;
    onReorder: (from: number, to: number) => void;
    children: React.ReactNode;
}) {
    const [over, setOver] = useState(false);

    return (
        <div
            className={`flex flex-col gap-2 rounded-md border border-sidebar-border/50 bg-muted/10 p-2 sm:flex-row sm:flex-wrap sm:items-center sm:border-transparent sm:bg-transparent sm:p-1 ${over ? 'border-primary/40 bg-muted/40' : ''}`}
            onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const raw = e.dataTransfer.getData('text/plain');
                const from = Number.parseInt(raw, 10);
                if (!Number.isNaN(from)) {
                    onReorder(from, index);
                }
            }}
        >
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(index));
                        e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="hidden cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:inline-flex"
                    aria-label="Drag to reorder"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <MobileReorderButtons
                    index={index}
                    listLength={listLength}
                    onReorder={onReorder}
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {children}
            </div>
        </div>
    );
}

export function PersonalDatesEditor({
    entries,
    onChange,
}: {
    entries: PersonalDateEntry[];
    onChange: (entries: PersonalDateEntry[]) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Personal dates</Label>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                            onChange([
                                ...entries,
                                { date: '', label: '', priority: 'high' },
                            ])
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add date
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            onChange([
                                ...entries,
                                {
                                    starts_on: '',
                                    ends_on: '',
                                    label: '',
                                    priority: 'high',
                                },
                            ])
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add range
                    </Button>
                </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
                Single dates score days off. Ranges also count vacation cost
                against your bank for workdays in the range.
            </p>
            <div className="space-y-2">
                {entries.map((entry, idx) => (
                    <DraggableRow
                        key={entryKey(entry, idx)}
                        index={idx}
                        listLength={entries.length}
                        onReorder={(from, to) =>
                            onChange(moveIndex(entries, from, to))
                        }
                    >
                        {isRangeEntry(entry) ? (
                            <>
                                <Input
                                    className="h-8 min-w-[6rem] flex-1 text-xs"
                                    placeholder="Label"
                                    value={entry.label}
                                    onChange={(e) => {
                                        const next = [...entries];
                                        next[idx] = {
                                            ...next[idx],
                                            label: e.target.value,
                                        };
                                        onChange(next);
                                    }}
                                />
                                <Input
                                    type="date"
                                    className={dateInputClass}
                                    value={entry.starts_on ?? ''}
                                    onChange={(e) => {
                                        const next = [...entries];
                                        next[idx] = {
                                            ...next[idx],
                                            starts_on: e.target.value,
                                        };
                                        onChange(next);
                                    }}
                                />
                                <Input
                                    type="date"
                                    className={dateInputClass}
                                    value={entry.ends_on ?? ''}
                                    onChange={(e) => {
                                        const next = [...entries];
                                        next[idx] = {
                                            ...next[idx],
                                            ends_on: e.target.value,
                                        };
                                        onChange(next);
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <Input
                                    type="date"
                                    className={dateInputClass}
                                    value={entry.date ?? ''}
                                    onChange={(e) => {
                                        const next = [...entries];
                                        next[idx] = {
                                            ...next[idx],
                                            date: e.target.value,
                                        };
                                        onChange(next);
                                    }}
                                />
                                <Input
                                    className="h-8 min-w-[6rem] flex-1 text-xs"
                                    placeholder="Label"
                                    value={entry.label}
                                    onChange={(e) => {
                                        const next = [...entries];
                                        next[idx] = {
                                            ...next[idx],
                                            label: e.target.value,
                                        };
                                        onChange(next);
                                    }}
                                />
                            </>
                        )}
                        <PrioritySelect
                            value={entry.priority}
                            onChange={(priority) => {
                                const next = [...entries];
                                next[idx] = { ...next[idx], priority };
                                onChange(next);
                            }}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                                onChange(entries.filter((_, i) => i !== idx))
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </DraggableRow>
                ))}
            </div>
        </div>
    );
}

export function personalDatesForSave(
    entries: PersonalDateEntry[],
): PersonalDateEntry[] {
    return entries.filter((entry) => {
        if (isRangeEntry(entry)) {
            return Boolean(entry.starts_on && entry.ends_on);
        }

        return Boolean(entry.date);
    });
}
