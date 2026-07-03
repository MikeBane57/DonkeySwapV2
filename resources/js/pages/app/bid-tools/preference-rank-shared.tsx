import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
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

export type Priority = 'ignore' | 'low' | 'high';

export type StartTimeTiebreakKey = '6' | '7' | '14' | '15' | '22';

/** Shared layout tokens for holidays / desk columns */
export const preferenceColumnClass = 'flex min-w-0 flex-col gap-1.5';
export const preferencePuckGroupClass =
    'flex min-w-[9.5rem] flex-col gap-1 rounded-md border border-sidebar-border/60 bg-muted/10 px-2 py-1.5';
export const preferencePuckRowClass =
    'flex min-h-[1.75rem] flex-wrap items-center gap-1 rounded-sm border border-transparent px-0.5 py-0';
export const preferencePuckLabelClass =
    'min-w-0 flex-1 truncate text-xs leading-tight';

export const START_TIME_TIEBREAK_DEFAULT: StartTimeTiebreakKey[] = [
    '6',
    '7',
    '14',
    '15',
    '22',
];

export const START_TIME_TIEBREAK_LABELS: Record<StartTimeTiebreakKey, string> =
    {
        '6': '06:00',
        '7': '07:00',
        '14': '14:00',
        '15': '15:00',
        '22': '22:00',
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

export function MobileReorderButtons({
    index,
    listLength,
    onReorder,
}: {
    index: number;
    listLength: number;
    onReorder: (from: number, to: number) => void;
}) {
    if (listLength <= 1) {
        return null;
    }

    return (
        <div className="flex shrink-0 md:hidden">
            <button
                type="button"
                disabled={index === 0}
                onClick={() => onReorder(index, index - 1)}
                className="rounded p-1 text-muted-foreground disabled:opacity-30"
                aria-label="Move up"
            >
                <ChevronUp className="h-4 w-4" />
            </button>
            <button
                type="button"
                disabled={index === listLength - 1}
                onClick={() => onReorder(index, index + 1)}
                className="rounded p-1 text-muted-foreground disabled:opacity-30"
                aria-label="Move down"
            >
                <ChevronDown className="h-4 w-4" />
            </button>
        </div>
    );
}

export function DraggablePreferenceRow({
    index,
    listLength,
    onReorder,
    children,
}: {
    index: number;
    listLength?: number;
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
                className="hidden shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:inline-flex"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            {listLength !== undefined && (
                <MobileReorderButtons
                    index={index}
                    listLength={listLength}
                    onReorder={onReorder}
                />
            )}
            {children}
        </div>
    );
}

export function StartTimeTiebreakPicker({
    value,
    onChange,
}: {
    value: StartTimeTiebreakKey[];
    onChange: (order: StartTimeTiebreakKey[]) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">Preferred start time tiebreaker</Label>
            <p className="text-[11px] text-muted-foreground">
                Drag to set which clock start ranks higher when lines are
                otherwise tied within the same desk tier.
            </p>
            <div
                className={`${preferencePuckGroupClass} flex-row flex-wrap gap-1.5`}
            >
                {value.map((hour, idx) => (
                    <DraggablePreferenceRow
                        key={hour}
                        index={idx}
                        listLength={value.length}
                        onReorder={(from, to) =>
                            onChange(moveIndex(value, from, to))
                        }
                    >
                        <span
                            className={`${preferencePuckLabelClass} font-medium`}
                        >
                            {START_TIME_TIEBREAK_LABELS[hour]}
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
                    listLength={entries.length}
                    onReorder={(from, to) =>
                        onChange(moveIndex(entries, from, to))
                    }
                >
                    <span
                        className={preferencePuckLabelClass}
                        title={entry.date}
                    >
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

export function normalizeStartTimeTiebreakOrder(
    raw: unknown,
): StartTimeTiebreakKey[] {
    const allowed: StartTimeTiebreakKey[] = [...START_TIME_TIEBREAK_DEFAULT];
    if (!Array.isArray(raw)) {
        return [...START_TIME_TIEBREAK_DEFAULT];
    }

    const order: StartTimeTiebreakKey[] = [];
    for (const item of raw) {
        if (item === 'am') {
            if (!order.includes('6')) {
                order.push('6');
            }
            if (!order.includes('7')) {
                order.push('7');
            }
            continue;
        }
        if (item === 'pm') {
            if (!order.includes('14')) {
                order.push('14');
            }
            if (!order.includes('15')) {
                order.push('15');
            }
            continue;
        }
        if (item === 'mid' && !order.includes('22')) {
            order.push('22');
            continue;
        }
        if (
            (item === '6' ||
                item === '7' ||
                item === '14' ||
                item === '15' ||
                item === '22') &&
            !order.includes(item)
        ) {
            order.push(item);
        }
    }

    for (const hour of allowed) {
        if (!order.includes(hour)) {
            order.push(hour);
        }
    }

    return order;
}

export function normalizeCriteriaOrder(raw: unknown): string[] {
    const defaultOrder = ['holiday', 'personal', 'desk'];
    if (!Array.isArray(raw)) {
        return defaultOrder;
    }

    const allowed = new Set(defaultOrder);
    const order: string[] = [];
    for (const item of raw) {
        if (item === 'start_time') {
            continue;
        }
        if (
            typeof item === 'string' &&
            allowed.has(item) &&
            !order.includes(item)
        ) {
            order.push(item);
        }
    }

    for (const key of defaultOrder) {
        if (!order.includes(key)) {
            order.push(key);
        }
    }

    return order;
}
