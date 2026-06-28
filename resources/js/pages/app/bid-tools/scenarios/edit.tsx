import { Head, Link, router, usePage } from '@inertiajs/react';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
import AppLayout from '@/layouts/app-layout';
import { TieredRankList } from '@/pages/app/bid-tools/tiered-rank-list';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Scenario', href: '#' },
];

type Priority = 'ignore' | 'low' | 'high';

type VacationRange = {
    id?: number;
    title: string;
    starts_on: string;
    ends_on: string;
};

type HolidayEntry = {
    date: string;
    label: string;
    id?: string;
    priority: Priority;
};

type KeyedEntry = { key: string; priority: Priority; tier?: number };

type PersonalEntry = { date: string; label: string; priority: Priority };

type SortMode = 'weighted' | 'priority';

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
    const [over, setOver] = useState(false);

    return (
        <div
            className={`flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 ${over ? 'border-primary/40 bg-muted/40' : ''}`}
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

function flattenErrors(errors: Record<string, string>): string[] {
    return Object.values(errors);
}

export default function BidScenarioEdit({
    scenario,
    distinctCodes,
    holidaysCatalog,
    deskCatalog,
    startTimeCatalog,
}: {
    scenario: {
        id: number;
        name: string;
        vacation_bank: number;
        weights: Record<string, unknown> & {
            sort_mode?: SortMode;
            criteria_order?: string[];
        };
        holiday_rank: HolidayEntry[];
        desk_rank: KeyedEntry[];
        start_time_rank: KeyedEntry[];
        personal_dates: PersonalEntry[];
        import: {
            bid_year: number;
            file_hash: string;
            is_current: boolean;
        };
        vacation_ranges: VacationRange[];
    };
    distinctCodes: string[];
    holidaysCatalog: { date: string; id: string; label: string }[];
    deskCatalog: { key: string; label: string }[];
    startTimeCatalog: { key: string; label: string }[];
}) {
    const page = usePage<{
        errors?: Record<string, string>;
        flash?: { success?: string; error?: string };
    }>();
    const errors = page.props.errors ?? {};
    const flash = page.props.flash;
    const validationMessages = flattenErrors(errors);

    const [name, setName] = useState(scenario.name);
    const [vacationBank, setVacationBank] = useState(scenario.vacation_bank);
    const [weights, setWeights] = useState({
        holiday: Number(scenario.weights?.holiday ?? 1),
        personal: Number(scenario.weights?.personal ?? 1),
        start_time: Number(scenario.weights?.start_time ?? 1),
        desk: Number(scenario.weights?.desk ?? 1),
        vacation_penalty: Number(scenario.weights?.vacation_penalty ?? 1),
    });
    const [sortMode, setSortMode] = useState<SortMode>(() => {
        const mode = scenario.weights?.sort_mode;
        return mode === 'priority' ? 'priority' : 'weighted';
    });
    const [criteriaOrder, setCriteriaOrder] = useState<string[]>(() => {
        const o = scenario.weights?.criteria_order;
        if (Array.isArray(o) && o.length === 4) {
            return [...o];
        }

        return ['holiday', 'personal', 'start_time', 'desk'];
    });

    const [holidays, setHolidays] = useState<HolidayEntry[]>(
        scenario.holiday_rank,
    );
    const [deskRank, setDeskRank] = useState<KeyedEntry[]>(scenario.desk_rank);
    const [startRank, setStartRank] = useState<KeyedEntry[]>(
        scenario.start_time_rank,
    );
    const [personalDates, setPersonalDates] = useState<PersonalEntry[]>(
        scenario.personal_dates.length ? scenario.personal_dates : [],
    );

    const [ranges, setRanges] = useState<VacationRange[]>(
        scenario.vacation_ranges.length
            ? scenario.vacation_ranges.map((r) => ({
                  ...r,
                  title: r.title ?? '',
              }))
            : [],
    );
    const [endFreeByIdx, setEndFreeByIdx] = useState<Record<number, boolean>>(
        {},
    );
    const [saving, setSaving] = useState(false);

    const deskKeysInUse = useMemo(
        () => new Set(deskRank.map((d) => d.key)),
        [deskRank],
    );
    const startKeysInUse = useMemo(
        () => new Set(startRank.map((d) => d.key)),
        [startRank],
    );

    const addDeskOptions = deskCatalog.filter((d) => !deskKeysInUse.has(d.key));
    const addStartOptions = startTimeCatalog.filter(
        (d) => !startKeysInUse.has(d.key),
    );

    const deskLabels = useMemo(
        () =>
            Object.fromEntries(
                deskCatalog.map((d) => [d.key, d.label]),
            ) as Record<string, string>,
        [deskCatalog],
    );
    const startLabels = useMemo(
        () =>
            Object.fromEntries(
                startTimeCatalog.map((d) => [d.key, d.label]),
            ) as Record<string, string>,
        [startTimeCatalog],
    );

    const submit = useCallback(() => {
        setSaving(true);
        router.put(
            `/app/bid-tools/scenarios/${scenario.id}`,
            {
                name: name.trim(),
                vacation_bank: Math.max(
                    0,
                    Math.round(Number(vacationBank) || 0),
                ),
                weights: {
                    holiday: Number(weights.holiday) || 0,
                    personal: Number(weights.personal) || 0,
                    start_time: Number(weights.start_time) || 0,
                    desk: Number(weights.desk) || 0,
                    vacation_penalty: Number(weights.vacation_penalty) || 0,
                    sort_mode: sortMode,
                    criteria_order: criteriaOrder,
                },
                holiday_rank: holidays,
                desk_rank: deskRank,
                start_time_rank: startRank,
                personal_dates: personalDates.filter((p) => p.date),
                vacation_ranges: ranges.filter(
                    (r) => r.starts_on && r.ends_on,
                ),
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onError: () => setSaving(false),
            },
        );
    }, [
        name,
        vacationBank,
        weights,
        sortMode,
        criteriaOrder,
        holidays,
        deskRank,
        startRank,
        personalDates,
        ranges,
        scenario.id,
    ]);

    const resetHolidaysFromCatalog = () => {
        setHolidays(
            holidaysCatalog.map((h) => ({
                date: h.date,
                label: h.label,
                id: h.id,
                priority: 'high' as Priority,
            })),
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Scenario · ${scenario.name}`} />
            <div className="mx-auto max-w-3xl space-y-10 p-4 pb-16">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {scenario.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {scenario.import.bid_year}
                            {!scenario.import.is_current && (
                                <span className="ml-2 text-amber-700 dark:text-amber-300">
                                    (import replaced — scenario may be stale)
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/scenarios/${scenario.id}/ranked`}
                            >
                                Compare lines
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() =>
                                router.post(
                                    `/app/bid-tools/scenarios/${scenario.id}/duplicate`,
                                )
                            }
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                                if (
                                    confirm('Delete this scenario permanently?')
                                ) {
                                    router.delete(
                                        `/app/bid-tools/scenarios/${scenario.id}`,
                                    );
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-green-500/50 bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-200">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
                        {flash.error}
                    </div>
                )}
                {validationMessages.length > 0 && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                        <p className="font-medium">
                            Could not save — please fix the following:
                        </p>
                        <ul className="mt-1 list-inside list-disc">
                            {validationMessages.map((message, i) => (
                                <li key={i}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <form
                    className="space-y-10"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <section className="space-y-3">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </section>

                    <section className="space-y-3">
                        <Label htmlFor="vacation_bank">
                            Vacation bank (days)
                        </Label>
                        <Input
                            id="vacation_bank"
                            type="number"
                            min={0}
                            max={40}
                            className="max-w-[10rem]"
                            value={vacationBank}
                            onChange={(e) =>
                                setVacationBank(Number(e.target.value))
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            Vacation “cost” counts workdays inside your want-off
                            ranges (off days cost 0). We warn when cost exceeds
                            this bank.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label>Want-off ranges</Label>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    setRanges([
                                        ...ranges,
                                        {
                                            title: '',
                                            starts_on: '',
                                            ends_on: '',
                                        },
                                    ])
                                }
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add range
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Title is optional. End date matches start until you
                            change it.
                        </p>
                        {ranges.map((r, idx) => (
                            <div
                                key={idx}
                                className="flex flex-wrap items-end gap-2 rounded-lg border border-sidebar-border/60 p-3"
                            >
                                <div className="min-w-[8rem] flex-1 space-y-1">
                                    <Label className="text-xs">Title</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        placeholder="e.g. Spring break"
                                        value={r.title}
                                        onChange={(e) => {
                                            const next = [...ranges];
                                            next[idx] = {
                                                ...next[idx],
                                                title: e.target.value,
                                            };
                                            setRanges(next);
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Start</Label>
                                    <Input
                                        type="date"
                                        className={dateInputClass}
                                        value={r.starts_on}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            const next = [...ranges];
                                            const free = endFreeByIdx[idx];
                                            next[idx] = {
                                                ...next[idx],
                                                starts_on: v,
                                                ends_on:
                                                    free === true
                                                        ? next[idx].ends_on
                                                        : v,
                                            };
                                            setRanges(next);
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">End</Label>
                                    <Input
                                        type="date"
                                        className={dateInputClass}
                                        value={r.ends_on}
                                        onChange={(e) => {
                                            setEndFreeByIdx((m) => ({
                                                ...m,
                                                [idx]: true,
                                            }));
                                            const next = [...ranges];
                                            next[idx] = {
                                                ...next[idx],
                                                ends_on: e.target.value,
                                            };
                                            setRanges(next);
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground"
                                    onClick={() => {
                                        setRanges(
                                            ranges.filter((_, i) => i !== idx),
                                        );
                                        setEndFreeByIdx((m) => {
                                            const n = { ...m };
                                            delete n[idx];

                                            return n;
                                        });
                                    }}
                                    aria-label="Remove range"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {ranges.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No ranges yet. Use &quot;Add range&quot; to
                                count vacation cost against lines.
                            </p>
                        )}
                    </section>

                    <section className="space-y-3">
                        <Label htmlFor="sort-mode">Ranking mode</Label>
                        <Select
                            value={sortMode}
                            onValueChange={(mode) =>
                                setSortMode(mode as SortMode)
                            }
                        >
                            <SelectTrigger
                                id="sort-mode"
                                className="h-8 max-w-[20rem] text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weighted">
                                    Weighted — balance trade-offs
                                </SelectItem>
                                <SelectItem value="priority">
                                    Priority — top categories always win
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {sortMode === 'priority'
                                ? 'Lines are grouped by category order first (e.g. all AM before PM when start time is on top). Weights still scale gaps within each category.'
                                : 'Lines are ranked by total weighted score. Category order below only breaks ties when totals match.'}
                        </p>
                    </section>

                    <section className="space-y-3">
                        <Label>
                            {sortMode === 'priority'
                                ? 'Category ranking order'
                                : 'Overall priority when totals are close'}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            {sortMode === 'priority'
                                ? 'Drag to set which categories matter most. Higher categories always rank above lower ones.'
                                : 'Lines are ranked by total score first (weights control how much each category contributes). Drag to set which categories break ties when two lines score about the same.'}
                        </p>
                        <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                            {criteriaOrder.map((id, idx) => (
                                <DraggableRow
                                    key={id}
                                    index={idx}
                                    onReorder={(from, to) =>
                                        setCriteriaOrder((co) =>
                                            moveIndex(co, from, to),
                                        )
                                    }
                                >
                                    <span className="text-sm">
                                        {CRITERIA_LABELS[id] ?? id}
                                    </span>
                                </DraggableRow>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label>Holidays (drag = importance order)</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={resetHolidaysFromCatalog}
                            >
                                Reset list from calendar
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Higher in the list = more important. Priority
                            (high/low/don&apos;t care) controls how strongly each
                            item counts. Drag to rank.
                        </p>
                        <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                            {holidays.map((h, idx) => (
                                <DraggableRow
                                    key={`${h.date}-${idx}`}
                                    index={idx}
                                    onReorder={(from, to) =>
                                        setHolidays((list) =>
                                            moveIndex(list, from, to),
                                        )
                                    }
                                >
                                    <span className="min-w-0 flex-1 text-sm">
                                        <span className="font-medium">
                                            {h.label || h.date}
                                        </span>
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {h.date}
                                        </span>
                                    </span>
                                    <PrioritySelect
                                        value={h.priority}
                                        onChange={(p) => {
                                            const next = [...holidays];
                                            next[idx] = {
                                                ...next[idx],
                                                priority: p,
                                            };
                                            setHolidays(next);
                                        }}
                                    />
                                </DraggableRow>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <Label>Personal important dates</Label>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                                setPersonalDates([
                                    ...personalDates,
                                    {
                                        date: '',
                                        label: '',
                                        priority: 'high',
                                    },
                                ])
                            }
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add date
                        </Button>
                        <div className="space-y-2">
                            {personalDates.map((p, idx) => (
                                <DraggableRow
                                    key={idx}
                                    index={idx}
                                    onReorder={(from, to) =>
                                        setPersonalDates((list) =>
                                            moveIndex(list, from, to),
                                        )
                                    }
                                >
                                    <Input
                                        type="date"
                                        className={dateInputClass}
                                        value={p.date}
                                        onChange={(e) => {
                                            const next = [...personalDates];
                                            next[idx] = {
                                                ...next[idx],
                                                date: e.target.value,
                                            };
                                            setPersonalDates(next);
                                        }}
                                    />
                                    <Input
                                        className="h-8 max-w-[12rem] text-sm"
                                        placeholder="Label"
                                        value={p.label}
                                        onChange={(e) => {
                                            const next = [...personalDates];
                                            next[idx] = {
                                                ...next[idx],
                                                label: e.target.value,
                                            };
                                            setPersonalDates(next);
                                        }}
                                    />
                                    <PrioritySelect
                                        value={p.priority}
                                        onChange={(pr) => {
                                            const next = [...personalDates];
                                            next[idx] = {
                                                ...next[idx],
                                                priority: pr,
                                            };
                                            setPersonalDates(next);
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                            setPersonalDates(
                                                personalDates.filter(
                                                    (_, i) => i !== idx,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </DraggableRow>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        {addDeskOptions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                <Select
                                    onValueChange={(key) => {
                                        setDeskRank([
                                            ...deskRank,
                                            {
                                                key,
                                                priority: 'high',
                                                tier: deskRank.length + 1,
                                            },
                                        ]);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[11rem] text-xs">
                                        <SelectValue placeholder="Add desk…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {addDeskOptions.map((d) => (
                                            <SelectItem
                                                key={d.key}
                                                value={d.key}
                                            >
                                                {d.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <TieredRankList
                            idPrefix="scenario-desk"
                            label="Desk type preference"
                            hint="Group desk types that are equal to you (e.g. Sector + Router in the same group)."
                            entries={deskRank}
                            labels={deskLabels}
                            onChange={setDeskRank}
                            onRemoveKey={(key) =>
                                setDeskRank(deskRank.filter((d) => d.key !== key))
                            }
                        />
                    </section>

                    <section className="space-y-3">
                        {addStartOptions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                <Select
                                    onValueChange={(key) => {
                                        setStartRank([
                                            ...startRank,
                                            {
                                                key,
                                                priority: 'high',
                                                tier: startRank.length + 1,
                                            },
                                        ]);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[12rem] text-xs">
                                        <SelectValue placeholder="Add start…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {addStartOptions.map((d) => (
                                            <SelectItem
                                                key={d.key}
                                                value={d.key}
                                            >
                                                {d.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <TieredRankList
                            idPrefix="scenario-start"
                            label="Start time preference"
                            hint="Group start times that are equal (e.g. 06:00 and 07:00 for all AM lines)."
                            entries={startRank}
                            labels={startLabels}
                            onChange={setStartRank}
                            onRemoveKey={(key) =>
                                setStartRank(
                                    startRank.filter((d) => d.key !== key),
                                )
                            }
                        />
                    </section>

                    <section className="space-y-3">
                        <Label>Category weights (magnitude)</Label>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(
                                [
                                    'holiday',
                                    'personal',
                                    'start_time',
                                    'desk',
                                    'vacation_penalty',
                                ] as const
                            ).map((k) => (
                                <div key={k}>
                                    <Label className="text-xs capitalize">
                                        {k.replace('_', ' ')}
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        className="mt-1 h-8"
                                        value={weights[k]}
                                        onChange={(e) =>
                                            setWeights({
                                                ...weights,
                                                [k]: Number(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="rounded-lg border border-sidebar-border/70 p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                            Codes in file ({distinctCodes.length})
                        </p>
                        <p className="mt-1 break-all">
                            {distinctCodes.slice(0, 80).join(', ')}
                            {distinctCodes.length > 80 && ' …'}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save scenario'}
                        </Button>
                        <Button variant="outline" type="button" asChild>
                            <Link href="/app/bid-tools">Hub</Link>
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
