import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import {
    PersonalDatesEditor,
    personalDatesForSave
    
} from '@/pages/app/bid-tools/personal-dates-editor';
import type {PersonalDateEntry} from '@/pages/app/bid-tools/personal-dates-editor';
import {
    PreferenceColumnHeader,
    StartTimeTiebreakPicker,
    normalizeCriteriaOrder,
    normalizeStartTimeTiebreakOrder,
    preferenceColumnClass
    
} from '@/pages/app/bid-tools/preference-rank-shared';
import type {StartTimeTiebreakKey} from '@/pages/app/bid-tools/preference-rank-shared';
import { ScenarioWorkspace } from '@/pages/app/bid-tools/scenario-workspace';
import { TieredRankList } from '@/pages/app/bid-tools/tiered-rank-list';

export type Priority = 'ignore' | 'low' | 'high';

export type KeyedRankEntry = {
    key: string;
    priority: Priority;
    tier?: number;
};

export type SortMode = 'weighted' | 'priority' | 'blended' | 'group_ranked';

export type BidderProfile = {
    vacation_bank: number;
    holiday_rank: KeyedRankEntry[];
    desk_rank: KeyedRankEntry[];
    weights: {
        holiday: number;
        personal: number;
        desk: number;
        vacation_penalty: number;
        sort_mode: SortMode;
        criteria_order: string[];
        start_time_tiebreak_order?: StartTimeTiebreakKey[];
    };
    personal_dates: PersonalDateEntry[];
};

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Holidays',
    personal: 'Personal dates',
    desk: 'Desk type',
};

const HOLIDAY_LABELS: Record<string, string> = {
    christmas: 'Christmas (eve & day)',
    thanksgiving: 'Thanksgiving & Black Friday',
    july_4: 'Fourth of July',
    super_bowl: 'Super Bowl Sunday',
    new_years: "New Year's (eve & day)",
};

const DESK_LABELS: Record<string, string> = {
    DS: 'DS',
    DG: 'DG',
    DS7: 'DS7',
    DR: 'DR',
    DS_DR_MIX: 'DS/DR Mix',
    AG: 'AG',
    AS: 'AS',
    AS15: 'AS15',
    AR: 'AR',
    AS_AR_MIX: 'AS/AR Mix',
    MID: 'Mid',
    RELIEF: 'Relief',
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

function WeightSlider({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <Label htmlFor={id}>{label}</Label>
                <span className="text-muted-foreground tabular-nums">
                    {value}
                </span>
            </div>
            <input
                id={id}
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full"
            />
        </div>
    );
}

export function emptyBidderProfile(defaults: BidderProfile): BidderProfile {
    return {
        vacation_bank: defaults.vacation_bank,
        holiday_rank: defaults.holiday_rank.map((e) => ({ ...e })),
        desk_rank: defaults.desk_rank.map((e) => ({ ...e })),
        weights: {
            ...defaults.weights,
            sort_mode: defaults.weights.sort_mode ?? 'blended',
            criteria_order: normalizeCriteriaOrder(
                defaults.weights.criteria_order,
            ),
            start_time_tiebreak_order: normalizeStartTimeTiebreakOrder(
                defaults.weights.start_time_tiebreak_order,
            ),
        },
        personal_dates: [],
    };
}

export function profileFromTemplate(
    template: BidderProfile,
    overrides?: { vacation_bank?: number },
): BidderProfile {
    return {
        vacation_bank: overrides?.vacation_bank ?? template.vacation_bank,
        holiday_rank: template.holiday_rank.map((entry) => ({ ...entry })),
        desk_rank: template.desk_rank.map((entry) => ({ ...entry })),
        personal_dates: template.personal_dates.map((entry) => ({ ...entry })),
        weights: {
            ...template.weights,
            criteria_order: [...template.weights.criteria_order],
            start_time_tiebreak_order: template.weights.start_time_tiebreak_order
                ? [...template.weights.start_time_tiebreak_order]
                : undefined,
        },
    };
}

function normalizeRankEntries(
    entries: KeyedRankEntry[] | undefined,
    fallback: KeyedRankEntry[],
): KeyedRankEntry[] {
    if (Array.isArray(entries) && entries.length > 0) {
        return entries;
    }

    return fallback.map((entry) => ({ ...entry }));
}

export function BidderProfileFields({
    value,
    onChange,
    idPrefix = 'profile',
    rankDefaults,
    scenarioId,
    lines,
    hideVacationBank = false,
    hideLinePreview = false,
}: {
    value: BidderProfile;
    onChange: (profile: BidderProfile) => void;
    idPrefix?: string;
    rankDefaults?: Pick<BidderProfile, 'holiday_rank' | 'desk_rank'>;
    scenarioId?: number;
    lines?: LinePickerRow[];
    hideVacationBank?: boolean;
    hideLinePreview?: boolean;
}) {
    const holidayRank = normalizeRankEntries(
        value.holiday_rank,
        rankDefaults?.holiday_rank ?? [],
    );
    const deskRank = normalizeRankEntries(
        value.desk_rank,
        rankDefaults?.desk_rank ?? [],
    );
    const setWeights = (patch: Partial<BidderProfile['weights']>) => {
        onChange({ ...value, weights: { ...value.weights, ...patch } });
    };

    const previewDraft = useMemo(
        () => ({
            vacation_bank: value.vacation_bank,
            weights: value.weights,
            holiday_rank: holidayRank,
            desk_rank: deskRank,
            personal_dates: personalDatesForSave(value.personal_dates),
        }),
        [value, holidayRank, deskRank],
    );

    return (
        <div className="space-y-3">
            {!hideVacationBank && (
                <BidToolsCollapsibleSection
                    title="Basics"
                    summary={`Bank ${value.vacation_bank}`}
                    defaultOpen={false}
                >
                    <div className="space-y-1.5">
                        <Label htmlFor={`${idPrefix}-vacation-bank`}>
                            Vacation bank
                        </Label>
                        <Input
                            id={`${idPrefix}-vacation-bank`}
                            type="number"
                            min={0}
                            max={255}
                            className="h-8 max-w-[8rem] text-sm"
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
                </BidToolsCollapsibleSection>
            )}

            <BidToolsCollapsibleSection
                title="Holidays & desk"
                summary={`${holidayRank.length} hol · ${deskRank.length} desk`}
                defaultOpen={false}
            >
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                    <div className={preferenceColumnClass}>
                        <PreferenceColumnHeader title="Holidays" />
                        <TieredRankList
                            idPrefix={`${idPrefix}-holiday`}
                            label="Holidays"
                            entries={holidayRank}
                            labels={HOLIDAY_LABELS}
                            onChange={(holiday_rank) =>
                                onChange({ ...value, holiday_rank })
                            }
                            compact
                            hideLabel
                        />
                    </div>
                    <div className={preferenceColumnClass}>
                        <PreferenceColumnHeader title="Desk type" />
                        <TieredRankList
                            idPrefix={`${idPrefix}-desk`}
                            label="Desk type"
                            entries={deskRank}
                            labels={DESK_LABELS}
                            onChange={(desk_rank) =>
                                onChange({ ...value, desk_rank })
                            }
                            compact
                            hideLabel
                            hidePriority
                        />
                    </div>
                </div>
                <div className="mt-3 border-t border-sidebar-border/50 pt-3">
                    <StartTimeTiebreakPicker
                        value={normalizeStartTimeTiebreakOrder(
                            value.weights.start_time_tiebreak_order,
                        )}
                        onChange={(start_time_tiebreak_order) =>
                            setWeights({ start_time_tiebreak_order })
                        }
                    />
                </div>
            </BidToolsCollapsibleSection>

            <BidToolsCollapsibleSection
                title="Personal dates"
                summary={`${value.personal_dates.length} entr${value.personal_dates.length === 1 ? 'y' : 'ies'}`}
                defaultOpen={false}
            >
                <PersonalDatesEditor
                    entries={value.personal_dates}
                    onChange={(personal_dates) =>
                        onChange({ ...value, personal_dates })
                    }
                />
            </BidToolsCollapsibleSection>

            <BidToolsCollapsibleSection
                title="Ranking"
                summary={value.weights.sort_mode ?? 'blended'}
                defaultOpen={false}
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-sort-mode`}>
                            Ranking mode
                        </Label>
                        <Select
                            value={value.weights.sort_mode ?? 'weighted'}
                            onValueChange={(mode) =>
                                setWeights({ sort_mode: mode as SortMode })
                            }
                        >
                            <SelectTrigger
                                id={`${idPrefix}-sort-mode`}
                                className="h-8 max-w-[20rem] text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="group_ranked">
                                    Group ranked — G1, G2… then category order
                                </SelectItem>
                                <SelectItem value="blended">
                                    Blended — groups + category order
                                </SelectItem>
                                <SelectItem value="weighted">
                                    Weighted — balance trade-offs
                                </SelectItem>
                                <SelectItem value="priority">
                                    Priority — legacy blended
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Category order</Label>
                        <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                            {value.weights.criteria_order.map((key, idx) => (
                                <DraggableRow
                                    key={`${idPrefix}-crit-${key}`}
                                    index={idx}
                                    onReorder={(from, to) => {
                                        const order = moveIndex(
                                            value.weights.criteria_order,
                                            from,
                                            to,
                                        );
                                        setWeights({ criteria_order: order });
                                    }}
                                >
                                    <span className="text-sm">
                                        {CRITERIA_LABELS[key] ?? key}
                                    </span>
                                </DraggableRow>
                            ))}
                        </div>
                    </div>
                </div>
            </BidToolsCollapsibleSection>

            <BidToolsCollapsibleSection title="Weights" defaultOpen={false}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <WeightSlider
                        id={`${idPrefix}-w-holiday`}
                        label="Holiday weight"
                        value={value.weights.holiday}
                        onChange={(holiday) => setWeights({ holiday })}
                    />
                    <WeightSlider
                        id={`${idPrefix}-w-personal`}
                        label="Personal weight"
                        value={value.weights.personal}
                        onChange={(personal) => setWeights({ personal })}
                    />
                    <WeightSlider
                        id={`${idPrefix}-w-desk`}
                        label="Desk weight"
                        value={value.weights.desk}
                        onChange={(desk) => setWeights({ desk })}
                    />
                    <WeightSlider
                        id={`${idPrefix}-w-vac-penalty`}
                        label="Vacation penalty"
                        value={value.weights.vacation_penalty}
                        onChange={(vacation_penalty) =>
                            setWeights({ vacation_penalty })
                        }
                    />
                </div>
            </BidToolsCollapsibleSection>

            {!hideLinePreview && scenarioId && lines && lines.length > 0 && (
                <ScenarioWorkspace
                    scenarioId={scenarioId}
                    lines={lines}
                    draft={previewDraft}
                />
            )}
        </div>
    );
}
