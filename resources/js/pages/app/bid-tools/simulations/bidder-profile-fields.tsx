import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

export type KeyedRankEntry = {
    key: string;
    priority: Priority;
};

export type PersonalDate = {
    date: string;
    label: string;
    priority: Priority;
};

export type VacationRange = {
    title: string;
    starts_on: string;
    ends_on: string;
};

export type BidderProfile = {
    vacation_bank: number;
    holiday_rank: KeyedRankEntry[];
    desk_rank: KeyedRankEntry[];
    start_time_rank: KeyedRankEntry[];
    weights: {
        holiday: number;
        personal: number;
        start_time: number;
        desk: number;
        vacation_penalty: number;
        criteria_order: string[];
    };
    personal_dates: PersonalDate[];
    vacation_ranges: VacationRange[];
};

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Holidays',
    personal: 'Personal dates',
    start_time: 'Start time',
    desk: 'Desk type',
};

const HOLIDAY_LABELS: Record<string, string> = {
    christmas: 'Christmas (eve & day)',
    thanksgiving: 'Thanksgiving (eve & day)',
    new_years: "New Year's (eve & day)",
    july_4: 'Fourth of July',
};

const DESK_LABELS: Record<string, string> = {
    XG: 'XG',
    XR: 'XR (mix lines follow)',
    XS: 'XS',
    MID: 'Mid',
    RELIEF: 'Relief',
};

const START_TIME_LABELS: Record<string, string> = {
    '6': '06:00',
    '7': '07:00',
    '14': '14:00',
    '15': '15:00',
    '22': '22:00',
};

const dateInputClass =
    'h-8 text-xs [color-scheme:dark]';

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
                <span className="tabular-nums text-muted-foreground">{value}</span>
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

function KeyedRankList({
    idPrefix,
    label,
    hint,
    entries,
    labels,
    onChange,
}: {
    idPrefix: string;
    label: string;
    hint?: string;
    entries: KeyedRankEntry[];
    labels: Record<string, string>;
    onChange: (entries: KeyedRankEntry[]) => void;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {hint && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            <div className="space-y-1 rounded-lg border border-sidebar-border/60 p-2">
                {entries.map((entry, idx) => (
                    <DraggableRow
                        key={`${idPrefix}-${entry.key}`}
                        index={idx}
                        onReorder={(from, to) =>
                            onChange(moveIndex(entries, from, to))
                        }
                    >
                        <span className="min-w-0 flex-1 text-sm">
                            {labels[entry.key] ?? entry.key}
                        </span>
                        <PrioritySelect
                            value={entry.priority}
                            onChange={(priority) => {
                                const next = [...entries];
                                next[idx] = { ...next[idx], priority };
                                onChange(next);
                            }}
                        />
                    </DraggableRow>
                ))}
            </div>
        </div>
    );
}

export function emptyBidderProfile(defaults: BidderProfile): BidderProfile {
    return {
        vacation_bank: defaults.vacation_bank,
        holiday_rank: defaults.holiday_rank.map((e) => ({ ...e })),
        desk_rank: defaults.desk_rank.map((e) => ({ ...e })),
        start_time_rank: defaults.start_time_rank.map((e) => ({ ...e })),
        weights: {
            ...defaults.weights,
            criteria_order: [...defaults.weights.criteria_order],
        },
        personal_dates: [],
        vacation_ranges: [],
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
}: {
    value: BidderProfile;
    onChange: (profile: BidderProfile) => void;
    idPrefix?: string;
    rankDefaults?: Pick<
        BidderProfile,
        'holiday_rank' | 'desk_rank' | 'start_time_rank'
    >;
}) {
    const [weightsOpen, setWeightsOpen] = useState(false);
    const holidayRank = normalizeRankEntries(
        value.holiday_rank,
        rankDefaults?.holiday_rank ?? [],
    );
    const deskRank = normalizeRankEntries(
        value.desk_rank,
        rankDefaults?.desk_rank ?? [],
    );
    const startTimeRank = normalizeRankEntries(
        value.start_time_rank,
        rankDefaults?.start_time_rank ?? [],
    );
    const setWeights = (patch: Partial<BidderProfile['weights']>) => {
        onChange({ ...value, weights: { ...value.weights, ...patch } });
    };

    return (
        <div className="space-y-4 rounded-md border border-sidebar-border/50 bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
                Preference profile
            </p>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-vacation-bank`}>Vacation bank</Label>
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
                            vacation_bank: Math.max(0, Number(e.target.value) || 0),
                        })
                    }
                />
            </div>

            <KeyedRankList
                idPrefix={`${idPrefix}-holiday`}
                label="Holiday preference"
                hint="Drag to set importance order. Eve and day share the same rank."
                entries={holidayRank}
                labels={HOLIDAY_LABELS}
                onChange={(holiday_rank) => onChange({ ...value, holiday_rank })}
            />

            <KeyedRankList
                idPrefix={`${idPrefix}-desk`}
                label="Desk type preference"
                hint="Drag to set importance order. Mixed-desk lines follow XR."
                entries={deskRank}
                labels={DESK_LABELS}
                onChange={(desk_rank) => onChange({ ...value, desk_rank })}
            />

            <KeyedRankList
                idPrefix={`${idPrefix}-start`}
                label="Start time preference"
                hint="Drag to set importance order."
                entries={startTimeRank}
                labels={START_TIME_LABELS}
                onChange={(start_time_rank) =>
                    onChange({ ...value, start_time_rank })
                }
            />

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Vacation want-off ranges</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            onChange({
                                ...value,
                                vacation_ranges: [
                                    ...value.vacation_ranges,
                                    { title: '', starts_on: '', ends_on: '' },
                                ],
                            })
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add range
                    </Button>
                </div>
                {value.vacation_ranges.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None added.</p>
                ) : (
                    <ul className="space-y-2">
                        {value.vacation_ranges.map((range, idx) => (
                            <li
                                key={`${idPrefix}-vac-${idx}`}
                                className="flex flex-wrap items-end gap-2"
                            >
                                <Input
                                    placeholder="Label"
                                    className="h-8 min-w-[6rem] flex-1 text-xs"
                                    value={range.title}
                                    onChange={(e) => {
                                        const vacation_ranges = [...value.vacation_ranges];
                                        vacation_ranges[idx] = {
                                            ...range,
                                            title: e.target.value,
                                        };
                                        onChange({ ...value, vacation_ranges });
                                    }}
                                />
                                <Input
                                    type="date"
                                    className={`${dateInputClass} w-[9.5rem]`}
                                    value={range.starts_on}
                                    onChange={(e) => {
                                        const vacation_ranges = [...value.vacation_ranges];
                                        vacation_ranges[idx] = {
                                            ...range,
                                            starts_on: e.target.value,
                                        };
                                        onChange({ ...value, vacation_ranges });
                                    }}
                                />
                                <Input
                                    type="date"
                                    className={`${dateInputClass} w-[9.5rem]`}
                                    value={range.ends_on}
                                    onChange={(e) => {
                                        const vacation_ranges = [...value.vacation_ranges];
                                        vacation_ranges[idx] = {
                                            ...range,
                                            ends_on: e.target.value,
                                        };
                                        onChange({ ...value, vacation_ranges });
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onChange({
                                            ...value,
                                            vacation_ranges: value.vacation_ranges.filter(
                                                (_, i) => i !== idx,
                                            ),
                                        })
                                    }
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Personal want-off dates</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            onChange({
                                ...value,
                                personal_dates: [
                                    ...value.personal_dates,
                                    { date: '', label: '', priority: 'high' },
                                ],
                            })
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add date
                    </Button>
                </div>
                {value.personal_dates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None added.</p>
                ) : (
                    <ul className="space-y-2">
                        {value.personal_dates.map((entry, idx) => (
                            <li
                                key={`${idPrefix}-per-${idx}`}
                                className="flex flex-wrap items-center gap-2"
                            >
                                <Input
                                    type="date"
                                    className={`${dateInputClass} w-[9.5rem]`}
                                    value={entry.date}
                                    onChange={(e) => {
                                        const personal_dates = [...value.personal_dates];
                                        personal_dates[idx] = {
                                            ...entry,
                                            date: e.target.value,
                                        };
                                        onChange({ ...value, personal_dates });
                                    }}
                                />
                                <Input
                                    placeholder="Label"
                                    className="h-8 min-w-[6rem] flex-1 text-xs"
                                    value={entry.label}
                                    onChange={(e) => {
                                        const personal_dates = [...value.personal_dates];
                                        personal_dates[idx] = {
                                            ...entry,
                                            label: e.target.value,
                                        };
                                        onChange({ ...value, personal_dates });
                                    }}
                                />
                                <PrioritySelect
                                    value={entry.priority}
                                    onChange={(priority) => {
                                        const personal_dates = [...value.personal_dates];
                                        personal_dates[idx] = { ...entry, priority };
                                        onChange({ ...value, personal_dates });
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onChange({
                                            ...value,
                                            personal_dates: value.personal_dates.filter(
                                                (_, i) => i !== idx,
                                            ),
                                        })
                                    }
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="space-y-2">
                <Label>Tie-break order</Label>
                <p className="text-xs text-muted-foreground">
                    Used when total scores tie. First criteria break ties before
                    later ones.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                    {value.weights.criteria_order.map((key, idx) => (
                        <div
                            key={`${idPrefix}-crit-${idx}`}
                            className="flex items-center gap-2 text-xs"
                        >
                            <span className="w-6 text-muted-foreground">
                                {idx + 1}.
                            </span>
                            <Select
                                value={key}
                                onValueChange={(next) => {
                                    const order = [
                                        ...value.weights.criteria_order,
                                    ];
                                    const existing = order.indexOf(next);
                                    if (existing >= 0) {
                                        order[existing] = order[idx];
                                    }
                                    order[idx] = next;
                                    setWeights({ criteria_order: order });
                                }}
                            >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CRITERIA_LABELS).map(
                                        ([k, label]) => (
                                            <SelectItem key={k} value={k}>
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            </div>

            <Collapsible open={weightsOpen} onOpenChange={setWeightsOpen}>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border border-sidebar-border/60 px-3 py-2 text-left text-sm font-medium"
                    >
                        <span>Weights</span>
                        <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${weightsOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
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
                            id={`${idPrefix}-w-start`}
                            label="Start time weight"
                            value={value.weights.start_time}
                            onChange={(start_time) => setWeights({ start_time })}
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
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
