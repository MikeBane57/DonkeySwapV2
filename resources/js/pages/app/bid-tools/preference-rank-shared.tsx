import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { DeskGroupShift } from '@/pages/app/bid-tools/desk-group-shift';

export type Priority = 'ignore' | 'low' | 'high';

/** Shared layout tokens for holidays / desk / start columns */
export const preferenceColumnClass = 'flex min-w-0 flex-col gap-1.5';
export const preferencePuckGroupClass =
    'flex min-w-[9.5rem] flex-col gap-1 rounded-md border border-sidebar-border/60 bg-muted/10 px-2 py-1.5';
export const preferencePuckRowClass =
    'flex min-h-[1.75rem] items-center gap-1 rounded-sm border border-transparent px-0.5 py-0';
export const preferencePuckLabelClass =
    'min-w-0 flex-1 truncate text-xs leading-tight';

export const SHIFT_ORDER_DEFAULT: DeskGroupShift[] = ['am', 'pm', 'mid'];

export const SHIFT_LABELS: Record<DeskGroupShift, string> = {
    am: 'AM (D*)',
    pm: 'PM (A*)',
    mid: 'Mid (M*)',
};

function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const n = [...list];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);

    return n;
}

export function CompactPrioritySelect({
    value,
    onChange,
}: {
    value: Priority;
    onChange: (p: Priority) => void;
}) {
    return (
        <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
            <SelectTrigger className="h-7 w-[6.25rem] shrink-0 px-2 text-[11px]">
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

export function PreferenceColumnHeader({
    title,
    action,
}: {
    title: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
            <Label className="text-xs font-medium">{title}</Label>
            {action}
        </div>
    );
}

export function DraggablePreferenceRow({
    index,
    onReorder,
    children,
}: {
    index: number;
    onReorder: (from: number, to: number) => void;
    children: ReactNode;
}) {
    const [over, setOver] = useState(false);

    return (
        <div
            className={`${preferencePuckRowClass} ${over ? 'border-primary/40 bg-muted/40' : ''}`}
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
            <button
                type="button"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                className="cursor-grab touch-none shrink-0 text-muted-foreground active:cursor-grabbing"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            {children}
        </div>
    );
}

export function ShiftOrderPicker({
    value,
    onChange,
}: {
    value: DeskGroupShift[];
    onChange: (order: DeskGroupShift[]) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">Start shift order</Label>
            <p className="text-[11px] text-muted-foreground">
                Drag to set which desk shift (AM / PM / Mid) ranks higher when
                lines are otherwise tied.
            </p>
            <div className={`${preferencePuckGroupClass} flex-row flex-wrap gap-1.5`}>
                {value.map((shift, idx) => (
                    <DraggablePreferenceRow
                        key={shift}
                        index={idx}
                        onReorder={(from, to) =>
                            onChange(moveIndex(value, from, to))
                        }
                    >
                        <span
                            className={`${preferencePuckLabelClass} font-medium`}
                        >
                            {SHIFT_LABELS[shift]}
                        </span>
                    </DraggablePreferenceRow>
                ))}
            </div>
        </div>
    );
}

export type HolidayRankEntry = {
    date: string;
    label: string;
    id?: string;
    priority: Priority;
};

export function HolidayRankList({
    entries,
    onChange,
}: {
    entries: HolidayRankEntry[];
    onChange: (entries: HolidayRankEntry[]) => void;
}) {
    return (
        <div className={`${preferencePuckGroupClass} gap-1`}>
            {entries.map((entry, idx) => (
                <DraggablePreferenceRow
                    key={`${entry.date}-${idx}`}
                    index={idx}
                    onReorder={(from, to) =>
                        onChange(moveIndex(entries, from, to))
                    }
                >
                    <span className={preferencePuckLabelClass} title={entry.date}>
                        {entry.label || entry.date}
                    </span>
                    <CompactPrioritySelect
                        value={entry.priority}
                        onChange={(priority) => {
                            const next = [...entries];
                            next[idx] = { ...next[idx], priority };
                            onChange(next);
                        }}
                    />
                </DraggablePreferenceRow>
            ))}
        </div>
    );
}

export function normalizeShiftOrder(
    raw: unknown,
): DeskGroupShift[] {
    const allowed: DeskGroupShift[] = ['am', 'pm', 'mid'];
    if (!Array.isArray(raw)) {
        return [...SHIFT_ORDER_DEFAULT];
    }

    const order: DeskGroupShift[] = [];
    for (const item of raw) {
        if (
            (item === 'am' || item === 'pm' || item === 'mid') &&
            !order.includes(item)
        ) {
            order.push(item);
        }
    }

    for (const shift of allowed) {
        if (!order.includes(shift)) {
            order.push(shift);
        }
    }

    return order;
}
