import { Head, Link, router, usePage } from '@inertiajs/react';
import { Copy, GripVertical } from 'lucide-react';
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
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import {
    PersonalDatesEditor,
    personalDatesForSave
    
} from '@/pages/app/bid-tools/personal-dates-editor';
import type {PersonalDateEntry} from '@/pages/app/bid-tools/personal-dates-editor';
import {
    HolidayRankList,
    PreferenceColumnHeader,
    StartTimeTiebreakPicker,
    normalizeCriteriaOrder,
    normalizeStartTimeTiebreakOrder,
    preferenceColumnClass
    
} from '@/pages/app/bid-tools/preference-rank-shared';
import type {StartTimeTiebreakKey} from '@/pages/app/bid-tools/preference-rank-shared';
import { ScenarioWorkspace } from '@/pages/app/bid-tools/scenario-workspace';
import { TieredRankList } from '@/pages/app/bid-tools/tiered-rank-list';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Scenario', href: '#' },
];

type Priority = 'ignore' | 'low' | 'high';

type HolidayEntry = {
    date: string;
    label: string;
    id?: string;
    priority: Priority;
};

type KeyedEntry = { key: string; priority: Priority; tier?: number };

type SortMode = 'weighted' | 'priority' | 'blended';

function usesTierGroupSort(mode: SortMode): boolean {
    return mode === 'priority' || mode === 'blended';
}

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Holidays',
    personal: 'Personal dates',
    desk: 'Desk type',
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

function flattenErrors(errors: Record<string, string>): string[] {
    return Object.values(errors);
}

export default function BidScenarioEdit({
    scenario,
    distinctCodes,
    holidaysCatalog,
    deskCatalog,
    lines,
}: {
    scenario: {
        id: number;
        name: string;
        vacation_bank: number;
        weights: Record<string, unknown> & {
            sort_mode?: SortMode;
            criteria_order?: string[];
            start_time_tiebreak_order?: StartTimeTiebreakKey[];
            shift_order?: string[];
        };
        holiday_rank: HolidayEntry[];
        desk_rank: KeyedEntry[];
        personal_dates: PersonalDateEntry[];
        import: {
            bid_year: number;
            file_hash: string;
            is_current: boolean;
        };
    };
    distinctCodes: string[];
    holidaysCatalog: { date: string; id: string; label: string }[];
    deskCatalog: { key: string; label: string }[];
    lines: LinePickerRow[];
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
        desk: Number(scenario.weights?.desk ?? 1),
        vacation_penalty: Number(scenario.weights?.vacation_penalty ?? 1),
    });
    const [sortMode, setSortMode] = useState<SortMode>(() => {
        const mode = scenario.weights?.sort_mode;
        if (mode === 'priority' || mode === 'blended' || mode === 'weighted') {
            return mode;
        }

        return 'blended';
    });
    const [criteriaOrder, setCriteriaOrder] = useState<string[]>(() =>
        normalizeCriteriaOrder(scenario.weights?.criteria_order),
    );
    const [startTimeTiebreakOrder, setStartTimeTiebreakOrder] = useState<
        StartTimeTiebreakKey[]
    >(() =>
        normalizeStartTimeTiebreakOrder(
            scenario.weights?.start_time_tiebreak_order ??
                scenario.weights?.shift_order,
        ),
    );

    const [holidays, setHolidays] = useState<HolidayEntry[]>(
        scenario.holiday_rank,
    );
    const [deskRank, setDeskRank] = useState<KeyedEntry[]>(scenario.desk_rank);
    const [personalDates, setPersonalDates] = useState<PersonalDateEntry[]>(
        scenario.personal_dates.length ? scenario.personal_dates : [],
    );
    const [saving, setSaving] = useState(false);

    const deskKeysInUse = useMemo(
        () => new Set(deskRank.map((d) => d.key)),
        [deskRank],
    );
    const addDeskOptions = deskCatalog.filter((d) => !deskKeysInUse.has(d.key));

    const deskLabels = useMemo(
        () =>
            Object.fromEntries(
                deskCatalog.map((d) => [d.key, d.label]),
            ) as Record<string, string>,
        [deskCatalog],
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
                    desk: Number(weights.desk) || 0,
                    vacation_penalty: Number(weights.vacation_penalty) || 0,
                    sort_mode: sortMode,
                    criteria_order: criteriaOrder,
                    start_time_tiebreak_order: startTimeTiebreakOrder,
                },
                holiday_rank: holidays,
                desk_rank: deskRank,
                personal_dates: personalDatesForSave(personalDates),
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
        startTimeTiebreakOrder,
        holidays,
        deskRank,
        personalDates,
        scenario.id,
    ]);

    const previewDraft = useMemo(
        () => ({
            vacation_bank: Math.max(0, Math.round(Number(vacationBank) || 0)),
            weights: {
                holiday: Number(weights.holiday) || 0,
                personal: Number(weights.personal) || 0,
                desk: Number(weights.desk) || 0,
                vacation_penalty: Number(weights.vacation_penalty) || 0,
                sort_mode: sortMode,
                criteria_order: criteriaOrder,
                start_time_tiebreak_order: startTimeTiebreakOrder,
            },
            holiday_rank: holidays,
            desk_rank: deskRank,
            personal_dates: personalDatesForSave(personalDates),
        }),
        [
            vacationBank,
            weights,
            sortMode,
            criteriaOrder,
            startTimeTiebreakOrder,
            holidays,
            deskRank,
            personalDates,
        ],
    );

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
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-16">
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
                                Print view
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
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <BidToolsCollapsibleSection
                        title="Basics"
                        summary={name}
                        defaultOpen
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    className="h-8"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="vacation_bank">
                                    Vacation bank (days)
                                </Label>
                                <Input
                                    id="vacation_bank"
                                    type="number"
                                    min={0}
                                    max={40}
                                    className="h-8 max-w-[10rem]"
                                    value={vacationBank}
                                    onChange={(e) =>
                                        setVacationBank(Number(e.target.value))
                                    }
                                />
                            </div>
                        </div>
                    </BidToolsCollapsibleSection>

                    <BidToolsCollapsibleSection
                        title="Ranking"
                        summary={sortMode}
                    >
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
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
                                        <SelectItem value="blended">
                                            Blended — groups + category order
                                            (recommended)
                                        </SelectItem>
                                        <SelectItem value="weighted">
                                            Weighted — balance trade-offs
                                        </SelectItem>
                                        <SelectItem value="priority">
                                            Priority — same as blended (legacy)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {sortMode === 'weighted'
                                        ? 'Lines are ranked by total weighted score. Category order below only breaks ties when totals match.'
                                        : 'Uses category order with equal preference groups — e.g. 06:00 Sector beats 06:00 Regional when Sector/Router are grouped above Regional.'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    {usesTierGroupSort(sortMode)
                                        ? 'Category ranking order'
                                        : 'Overall priority when totals are close'}
                                </Label>
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
                            </div>
                        </div>
                    </BidToolsCollapsibleSection>

                    <BidToolsCollapsibleSection
                        title="Holidays & desk"
                        summary={`${holidays.length} hol · ${deskRank.length} desk`}
                        defaultOpen
                    >
                        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                            <div className={preferenceColumnClass}>
                                <PreferenceColumnHeader
                                    title="Holidays"
                                    action={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={resetHolidaysFromCatalog}
                                        >
                                            Reset
                                        </Button>
                                    }
                                />
                                <HolidayRankList
                                    entries={holidays}
                                    onChange={setHolidays}
                                />
                            </div>

                            <div className={preferenceColumnClass}>
                                <PreferenceColumnHeader title="Desk type" />
                                {addDeskOptions.length > 0 && (
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
                                        <SelectTrigger className="h-8 w-full text-xs">
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
                                )}
                                <TieredRankList
                                    idPrefix="scenario-desk"
                                    label="Desk type"
                                    entries={deskRank}
                                    labels={deskLabels}
                                    onChange={setDeskRank}
                                    onRemoveKey={(key) =>
                                        setDeskRank(
                                            deskRank.filter(
                                                (d) => d.key !== key,
                                            ),
                                        )
                                    }
                                    compact
                                    hideLabel
                                />
                            </div>
                        </div>
                        <div className="mt-4 border-t border-sidebar-border/50 pt-4">
                            <StartTimeTiebreakPicker
                                value={startTimeTiebreakOrder}
                                onChange={setStartTimeTiebreakOrder}
                            />
                        </div>
                    </BidToolsCollapsibleSection>

                    <BidToolsCollapsibleSection
                        title="Personal dates"
                        summary={`${personalDates.length} entr${personalDates.length === 1 ? 'y' : 'ies'}`}
                    >
                        <PersonalDatesEditor
                            entries={personalDates}
                            onChange={setPersonalDates}
                        />
                    </BidToolsCollapsibleSection>

                    <BidToolsCollapsibleSection title="Category weights">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(
                                [
                                    'holiday',
                                    'personal',
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
                    </BidToolsCollapsibleSection>

                    <div className="rounded-lg border border-sidebar-border/70 p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                            Codes in file ({distinctCodes.length})
                        </p>
                        <p className="mt-1 break-all">
                            {distinctCodes.slice(0, 80).join(', ')}
                            {distinctCodes.length > 80 && ' …'}
                        </p>
                    </div>

                    <ScenarioWorkspace
                        scenarioId={scenario.id}
                        lines={lines}
                        draft={previewDraft}
                    />

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
