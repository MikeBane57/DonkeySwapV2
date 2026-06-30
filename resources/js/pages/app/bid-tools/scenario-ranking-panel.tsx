import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
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

export type Priority = 'ignore' | 'low' | 'high';

export type HolidayEntry = {
    date: string;
    label: string;
    id?: string;
    priority: Priority;
};

export type KeyedEntry = { key: string; priority: Priority };

export type PersonalEntry = { date: string; label: string; priority: Priority };

export type ScenarioRankingState = {
    vacation_bank: number;
    weights: {
        holiday: number;
        personal: number;
        start_time: number;
        desk: number;
        vacation_penalty: number;
        criteria_order: string[];
    };
    holiday_rank: HolidayEntry[];
    desk_rank: KeyedEntry[];
    start_time_rank: KeyedEntry[];
    personal_dates: PersonalEntry[];
};

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Holidays',
    personal: 'Personal dates',
    start_time: 'Start time',
    desk: 'Desk type',
};

const dateInputClass =
    'h-8 w-[9.25rem] text-xs [color-scheme:dark] sm:w-[9.5rem]';

function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const n = [...list];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);

    return n;
}

function DraggableRow({
    index,
    onReorder,
    children,
}: {
    index: number;
    onReorder: (from: number, to: number) => void;
    children: ReactNode;
}) {
    return (
        <div
            className="flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
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
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            {children}
        </div>
    );
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

export function ScenarioRankingPanel({
    value,
    onChange,
    holidaysCatalog,
    deskCatalog,
    startTimeCatalog,
}: {
    value: ScenarioRankingState;
    onChange: (next: ScenarioRankingState) => void;
    holidaysCatalog: { date: string; id: string; label: string }[];
    deskCatalog: { key: string; label: string }[];
    startTimeCatalog: { key: string; label: string }[];
}) {
    const deskKeysInUse = useMemo(
        () => new Set(value.desk_rank.map((d) => d.key)),
        [value.desk_rank],
    );
    const startKeysInUse = useMemo(
        () => new Set(value.start_time_rank.map((d) => d.key)),
        [value.start_time_rank],
    );

    const addDeskOptions = deskCatalog.filter((d) => !deskKeysInUse.has(d.key));
    const addStartOptions = startTimeCatalog.filter(
        (d) => !startKeysInUse.has(d.key),
    );

    const setWeights = (patch: Partial<ScenarioRankingState['weights']>) => {
        onChange({
            ...value,
            weights: { ...value.weights, ...patch },
        });
    };

    const resetHolidaysFromCatalog = () => {
        onChange({
            ...value,
            holiday_rank: holidaysCatalog.map((h) => ({
                date: h.date,
                label: h.label,
                id: h.id,
                priority: 'high',
            })),
        });
    };

    return (
        <div className="space-y-8">
            <section className="space-y-2">
                <Label htmlFor="ranked-vacation-bank">Vacation bank</Label>
                <Input
                    id="ranked-vacation-bank"
                    type="number"
                    min={0}
                    max={40}
                    className="max-w-[10rem]"
                    value={value.vacation_bank}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            vacation_bank: Math.max(
                                0,
                                Number(e.target.value) || 0,
                            ),
                        })
                    }
                />
            </section>

            <section className="space-y-2">
                <Label>Tie-break order</Label>
                <p className="text-xs text-muted-foreground">
                    Drag to set which categories break ties when totals match.
                </p>
                <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                    {value.weights.criteria_order.map((id, idx) => (
                        <DraggableRow
                            key={id}
                            index={idx}
                            onReorder={(from, to) =>
                                setWeights({
                                    criteria_order: moveIndex(
                                        value.weights.criteria_order,
                                        from,
                                        to,
                                    ),
                                })
                            }
                        >
                            <span className="text-sm">
                                {CRITERIA_LABELS[id] ?? id}
                            </span>
                        </DraggableRow>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Category weights</Label>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                        [
                            ['holiday', 'Holiday'],
                            ['personal', 'Personal'],
                            ['start_time', 'Start time'],
                            ['desk', 'Desk'],
                            ['vacation_penalty', 'Vacation penalty'],
                        ] as const
                    ).map(([key, label]) => (
                        <div key={key}>
                            <Label className="text-xs capitalize">{label}</Label>
                            <Input
                                type="number"
                                step={0.5}
                                min={0}
                                className="mt-1 h-8"
                                value={value.weights[key]}
                                onChange={(e) =>
                                    setWeights({
                                        [key]: Number(e.target.value) || 0,
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Holidays</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetHolidaysFromCatalog}
                    >
                        Reset from calendar
                    </Button>
                </div>
                <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                    {value.holiday_rank.map((h, idx) => (
                        <DraggableRow
                            key={`${h.date}-${idx}`}
                            index={idx}
                            onReorder={(from, to) =>
                                onChange({
                                    ...value,
                                    holiday_rank: moveIndex(
                                        value.holiday_rank,
                                        from,
                                        to,
                                    ),
                                })
                            }
                        >
                            <span className="min-w-0 flex-1 text-sm">
                                {h.label || h.date}
                            </span>
                            <PrioritySelect
                                value={h.priority}
                                onChange={(priority) => {
                                    const next = [...value.holiday_rank];
                                    next[idx] = { ...next[idx], priority };
                                    onChange({ ...value, holiday_rank: next });
                                }}
                            />
                        </DraggableRow>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Desk type preference</Label>
                    {addDeskOptions.length > 0 && (
                        <Select
                            onValueChange={(key) =>
                                onChange({
                                    ...value,
                                    desk_rank: [
                                        ...value.desk_rank,
                                        { key, priority: 'high' },
                                    ],
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-[11rem] text-xs">
                                <SelectValue placeholder="Add desk…" />
                            </SelectTrigger>
                            <SelectContent>
                                {addDeskOptions.map((d) => (
                                    <SelectItem key={d.key} value={d.key}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                    {value.desk_rank.map((d, idx) => (
                        <DraggableRow
                            key={d.key}
                            index={idx}
                            onReorder={(from, to) =>
                                onChange({
                                    ...value,
                                    desk_rank: moveIndex(
                                        value.desk_rank,
                                        from,
                                        to,
                                    ),
                                })
                            }
                        >
                            <span className="flex-1 text-sm">
                                {deskCatalog.find((x) => x.key === d.key)
                                    ?.label ?? d.key}
                            </span>
                            <PrioritySelect
                                value={d.priority}
                                onChange={(priority) => {
                                    const next = [...value.desk_rank];
                                    next[idx] = { ...next[idx], priority };
                                    onChange({ ...value, desk_rank: next });
                                }}
                            />
                        </DraggableRow>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Start time preference</Label>
                    {addStartOptions.length > 0 && (
                        <Select
                            onValueChange={(key) =>
                                onChange({
                                    ...value,
                                    start_time_rank: [
                                        ...value.start_time_rank,
                                        { key, priority: 'high' },
                                    ],
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-[12rem] text-xs">
                                <SelectValue placeholder="Add start…" />
                            </SelectTrigger>
                            <SelectContent>
                                {addStartOptions.map((d) => (
                                    <SelectItem key={d.key} value={d.key}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                    {value.start_time_rank.map((d, idx) => (
                        <DraggableRow
                            key={d.key}
                            index={idx}
                            onReorder={(from, to) =>
                                onChange({
                                    ...value,
                                    start_time_rank: moveIndex(
                                        value.start_time_rank,
                                        from,
                                        to,
                                    ),
                                })
                            }
                        >
                            <span className="flex-1 text-sm">
                                {startTimeCatalog.find((x) => x.key === d.key)
                                    ?.label ?? d.key}
                            </span>
                            <PrioritySelect
                                value={d.priority}
                                onChange={(priority) => {
                                    const next = [...value.start_time_rank];
                                    next[idx] = { ...next[idx], priority };
                                    onChange({
                                        ...value,
                                        start_time_rank: next,
                                    });
                                }}
                            />
                        </DraggableRow>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label>Personal dates</Label>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                            onChange({
                                ...value,
                                personal_dates: [
                                    ...value.personal_dates,
                                    {
                                        date: '',
                                        label: '',
                                        priority: 'high',
                                    },
                                ],
                            })
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add
                    </Button>
                </div>
                <div className="space-y-2">
                    {value.personal_dates.map((p, idx) => (
                        <DraggableRow
                            key={idx}
                            index={idx}
                            onReorder={(from, to) =>
                                onChange({
                                    ...value,
                                    personal_dates: moveIndex(
                                        value.personal_dates,
                                        from,
                                        to,
                                    ),
                                })
                            }
                        >
                            <Input
                                type="date"
                                className={dateInputClass}
                                value={p.date}
                                onChange={(e) => {
                                    const next = [...value.personal_dates];
                                    next[idx] = {
                                        ...next[idx],
                                        date: e.target.value,
                                    };
                                    onChange({
                                        ...value,
                                        personal_dates: next,
                                    });
                                }}
                            />
                            <PrioritySelect
                                value={p.priority}
                                onChange={(priority) => {
                                    const next = [...value.personal_dates];
                                    next[idx] = { ...next[idx], priority };
                                    onChange({
                                        ...value,
                                        personal_dates: next,
                                    });
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                    onChange({
                                        ...value,
                                        personal_dates:
                                            value.personal_dates.filter(
                                                (_, i) => i !== idx,
                                            ),
                                    })
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </DraggableRow>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function scenarioToRankingState(scenario: {
    vacation_bank: number;
    weights: Record<string, unknown> & { criteria_order?: string[] };
    holiday_rank: HolidayEntry[];
    desk_rank: KeyedEntry[];
    start_time_rank: KeyedEntry[];
    personal_dates: PersonalEntry[];
}): ScenarioRankingState {
    const criteria = scenario.weights?.criteria_order;
    const criteriaOrder =
        Array.isArray(criteria) && criteria.length === 4
            ? [...criteria]
            : ['holiday', 'personal', 'start_time', 'desk'];

    return {
        vacation_bank: scenario.vacation_bank,
        weights: {
            holiday: Number(scenario.weights?.holiday ?? 1),
            personal: Number(scenario.weights?.personal ?? 1),
            start_time: Number(scenario.weights?.start_time ?? 1),
            desk: Number(scenario.weights?.desk ?? 1),
            vacation_penalty: Number(scenario.weights?.vacation_penalty ?? 1),
            criteria_order: criteriaOrder,
        },
        holiday_rank: scenario.holiday_rank,
        desk_rank: scenario.desk_rank,
        start_time_rank: scenario.start_time_rank,
        personal_dates: scenario.personal_dates,
    };
}
