import { GripVertical } from 'lucide-react';
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
import {
    PersonalDatesEditor,
    personalDatesForSave,
} from '@/pages/app/bid-tools/personal-dates-editor';
import type { PersonalDateEntry } from '@/pages/app/bid-tools/personal-dates-editor';
import {
    HolidayRankList,
    MobileReorderButtons,
    PreferenceColumnHeader,
    StartTimeTiebreakPicker,
    normalizeCriteriaOrder,
    normalizeStartTimeTiebreakOrder,
    preferenceColumnClass,
} from '@/pages/app/bid-tools/preference-rank-shared';
import type { StartTimeTiebreakKey } from '@/pages/app/bid-tools/preference-rank-shared';
import { TieredRankList } from '@/pages/app/bid-tools/tiered-rank-list';

export type Priority = 'ignore' | 'low' | 'high';
export type SortMode = 'weighted' | 'priority' | 'blended' | 'group_ranked';

export type HolidayEntry = {
    date: string;
    label: string;
    id?: string;
    priority: Priority;
};

export type KeyedEntry = { key: string; priority: Priority; tier?: number };

export type ScenarioRankingState = {
    vacation_bank: number;
    weights: {
        holiday: number;
        personal: number;
        desk: number;
        vacation_penalty: number;
        sort_mode: SortMode;
        criteria_order: string[];
        start_time_tiebreak_order?: StartTimeTiebreakKey[];
    };
    holiday_rank: HolidayEntry[];
    desk_rank: KeyedEntry[];
    personal_dates: PersonalDateEntry[];
};

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Holidays',
    personal: 'Personal',
    desk: 'Desk',
};

const WEIGHT_LABELS: Record<string, string> = {
    holiday: 'Hol',
    personal: 'Per',
    desk: 'Desk',
    vacation_penalty: 'Vac',
};

function usesCategoryOrderSort(mode: SortMode): boolean {
    return mode === 'priority' || mode === 'blended' || mode === 'group_ranked';
}

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
    listLength,
    onReorder,
    children,
    compact = false,
}: {
    index: number;
    listLength: number;
    onReorder: (from: number, to: number) => void;
    children: ReactNode;
    compact?: boolean;
}) {
    return (
        <div
            className={
                compact
                    ? 'flex flex-wrap items-center gap-1 rounded-md border border-sidebar-border/60 bg-muted/30 px-2 py-1'
                    : 'flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1'
            }
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
                className="hidden cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:inline-flex"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <MobileReorderButtons
                index={index}
                listLength={listLength}
                onReorder={onReorder}
            />
            {children}
        </div>
    );
}

export function rankingStateToSavePayload(
    scenarioName: string,
    value: ScenarioRankingState,
) {
    return {
        name: scenarioName,
        vacation_bank: value.vacation_bank,
        weights: value.weights,
        holiday_rank: value.holiday_rank,
        desk_rank: value.desk_rank,
        personal_dates: personalDatesForSave(value.personal_dates),
    };
}

export function ScenarioRankingPanel({
    value,
    onChange,
    holidaysCatalog,
    deskCatalog,
}: {
    value: ScenarioRankingState;
    onChange: (next: ScenarioRankingState) => void;
    holidaysCatalog: { date: string; id: string; label: string }[];
    deskCatalog: { key: string; label: string }[];
}) {
    const sortMode = value.weights.sort_mode;
    const deskKeysInUse = useMemo(
        () => new Set(value.desk_rank.map((d) => d.key)),
        [value.desk_rank],
    );

    const addDeskOptions = deskCatalog.filter((d) => !deskKeysInUse.has(d.key));

    const deskLabels = useMemo(
        () =>
            Object.fromEntries(
                deskCatalog.map((d) => [d.key, d.label]),
            ) as Record<string, string>,
        [deskCatalog],
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
        <div className="space-y-6">
            <section className="space-y-3 rounded-lg border border-sidebar-border/60 bg-muted/10 p-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label
                            htmlFor="ranked-vacation-bank"
                            className="text-xs"
                        >
                            Vacation bank
                        </Label>
                        <Input
                            id="ranked-vacation-bank"
                            type="number"
                            min={0}
                            max={40}
                            className="h-8 w-20 text-sm"
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
                    </div>
                    <div className="min-w-[12rem] flex-1 space-y-1">
                        <Label htmlFor="ranked-sort-mode" className="text-xs">
                            Ranking mode
                        </Label>
                        <Select
                            value={sortMode}
                            onValueChange={(mode) =>
                                setWeights({ sort_mode: mode as SortMode })
                            }
                        >
                            <SelectTrigger
                                id="ranked-sort-mode"
                                className="h-8 text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="group_ranked">
                                    Group ranked
                                </SelectItem>
                                <SelectItem value="blended">
                                    Blended (recommended)
                                </SelectItem>
                                <SelectItem value="weighted">
                                    Weighted
                                </SelectItem>
                                <SelectItem value="priority">
                                    Priority
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                            {sortMode === 'weighted'
                                ? 'Weighted sorts by total score. Use Group ranked or Blended to enforce desk tier groups.'
                                : sortMode === 'group_ranked'
                                  ? `Group ranked fills G1 using category order (${value.weights.criteria_order.map((id) => CRITERIA_LABELS[id] ?? id).join(' → ')}), then G2, etc.`
                                  : `Blended compares categories in your order (${value.weights.criteria_order.map((id) => CRITERIA_LABELS[id] ?? id).join(' → ')}), using list position — not the weights below.`}
                        </p>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Category weights</Label>
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                'holiday',
                                'personal',
                                'desk',
                                'vacation_penalty',
                            ] as const
                        ).map((key) => (
                            <div key={key} className="space-y-0.5">
                                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                                    {WEIGHT_LABELS[key]}
                                </span>
                                <Input
                                    type="number"
                                    step={0.5}
                                    min={0}
                                    className="h-8 w-16 px-2 text-sm"
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
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">
                        {usesCategoryOrderSort(sortMode)
                            ? 'Category order'
                            : 'Tie-break order'}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {value.weights.criteria_order.map((id, idx) => (
                            <DraggableRow
                                key={id}
                                index={idx}
                                listLength={value.weights.criteria_order.length}
                                compact
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
                                <span className="text-xs font-medium">
                                    {CRITERIA_LABELS[id] ?? id}
                                </span>
                            </DraggableRow>
                        ))}
                    </div>
                </div>
                <StartTimeTiebreakPicker
                    value={normalizeStartTimeTiebreakOrder(
                        value.weights.start_time_tiebreak_order,
                    )}
                    onChange={(start_time_tiebreak_order) =>
                        setWeights({ start_time_tiebreak_order })
                    }
                />
            </section>

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
                        entries={value.holiday_rank}
                        onChange={(holiday_rank) =>
                            onChange({ ...value, holiday_rank })
                        }
                    />
                </div>

                <div className={preferenceColumnClass}>
                    <PreferenceColumnHeader title="Desk type" />
                    {addDeskOptions.length > 0 && (
                        <Select
                            onValueChange={(key) =>
                                onChange({
                                    ...value,
                                    desk_rank: [
                                        ...value.desk_rank,
                                        {
                                            key,
                                            priority: 'high',
                                            tier: value.desk_rank.length + 1,
                                        },
                                    ],
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-full text-xs">
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
                    <TieredRankList
                        idPrefix="ranked-desk"
                        label="Desk type"
                        entries={value.desk_rank}
                        labels={deskLabels}
                        onChange={(desk_rank) =>
                            onChange({ ...value, desk_rank })
                        }
                        onRemoveKey={(key) =>
                            onChange({
                                ...value,
                                desk_rank: value.desk_rank.filter(
                                    (d) => d.key !== key,
                                ),
                            })
                        }
                        compact
                        hideLabel
                        hidePriority
                    />
                </div>
            </div>

            <section className="space-y-2">
                <PersonalDatesEditor
                    entries={value.personal_dates}
                    onChange={(personal_dates) =>
                        onChange({ ...value, personal_dates })
                    }
                />
            </section>
        </div>
    );
}

export function scenarioToRankingState(scenario: {
    vacation_bank: number;
    weights: Record<string, unknown> & {
        criteria_order?: string[];
        sort_mode?: string;
        start_time_tiebreak_order?: string[];
        shift_order?: string[];
    };
    holiday_rank: HolidayEntry[];
    desk_rank: KeyedEntry[];
    personal_dates: PersonalDateEntry[];
}): ScenarioRankingState {
    const sortMode = scenario.weights?.sort_mode;
    const normalizedSortMode: SortMode =
        sortMode === 'weighted' ||
        sortMode === 'priority' ||
        sortMode === 'blended' ||
        sortMode === 'group_ranked'
            ? sortMode
            : 'blended';

    return {
        vacation_bank: scenario.vacation_bank,
        weights: {
            holiday: Number(scenario.weights?.holiday ?? 1),
            personal: Number(scenario.weights?.personal ?? 1),
            desk: Number(scenario.weights?.desk ?? 1),
            vacation_penalty: Number(scenario.weights?.vacation_penalty ?? 1),
            sort_mode: normalizedSortMode,
            criteria_order: normalizeCriteriaOrder(
                scenario.weights?.criteria_order,
            ),
            start_time_tiebreak_order: normalizeStartTimeTiebreakOrder(
                scenario.weights?.start_time_tiebreak_order ??
                    scenario.weights?.shift_order,
            ),
        },
        holiday_rank: scenario.holiday_rank,
        desk_rank: scenario.desk_rank,
        personal_dates: scenario.personal_dates,
    };
}
