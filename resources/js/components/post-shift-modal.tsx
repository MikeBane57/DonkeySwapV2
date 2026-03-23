import {
    Handshake,
    Plane,
    Repeat,
    Send,
    DollarSign,
    Edit,
    Trash2,
    History,
    Info,
    ChevronUp,
    ChevronDown,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCsrfToken } from '@/lib/csrf';
import { cn } from '@/lib/utils';

function formatTimeLabel(hhmm: string): string {
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10) || 0);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function normalizeHhmm(s: string): string {
    const parts = s.trim().split(':');
    const h = parseInt(parts[0] ?? '0', 10) || 0;
    const m = parseInt(parts[1] ?? '0', 10) || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type PaybackDateRange = { start: string; end: string };

export type ExistingPost = {
    id: number;
    type: string;
    cash_amount?: number | null;
    flight_follow_minutes?: number | null;
    flight_follow_at?: string | null;
    notes?: string | null;
    preferred_start_times?: string[] | null;
    preferred_desk_type?: string | null;
    payback_date_ranges?: PaybackDateRange[] | null;
    allow_counter_offers?: boolean;
};

const DESK_TYPE_LABELS: Record<string, string> = {
    domestic_dispatch: 'Domestic dispatch',
    assistant_desk: 'Assistant desk',
    etops: 'ETOPS',
    intl: 'INTL',
    regional: 'Regional (G)',
    sector: 'Sector (S)',
    nextday: 'NextDay (R)',
    extra: 'Extra',
};

type PostShiftModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shift: {
        shiftId: number;
        position_name: string;
        desk_type?: string | null;
        start: string;
        end: string;
        workgroup_id?: number | null;
        workgroup_name?: string;
        is_training?: boolean;
    };
    /** Start times for the shift's workgroup (e.g. ["06:00", "07:00"]). Used for time-trade preferred order. */
    allowedStartTimes?: { start_time: string }[];
    /** Workgroups with desk_types for resolving desk type labels by workgroup. */
    workgroups?: {
        id: number;
        desk_types?: { code: string; label: string }[];
    }[];
    existingPosts: ExistingPost[];
    /** When true, open with Flight following selected (e.g. from "Find FF" button). */
    preselectFlightFollow?: boolean;
    onSuccess: () => void;
};

export function PostShiftModal({
    open,
    onOpenChange,
    shift,
    allowedStartTimes = [],
    workgroups = [],
    existingPosts,
    preselectFlightFollow = false,
    onSuccess,
}: PostShiftModalProps) {
    const isTraining = shift.is_training ?? false;
    const safePosts = existingPosts.filter(
        (p): p is ExistingPost => p != null && typeof p.type === 'string',
    );
    const existingTrade = safePosts.find((p) => p.type === 'trade');
    const existingCash = safePosts.find((p) => p.type === 'cash');
    const existingFF = safePosts.find((p) => p.type === 'flight_follow');
    const existingTimeTrade = safePosts.find((p) => p.type === 'time_trade');

    const [postAsTrade, setPostAsTrade] = useState(!!existingTrade);
    const [postAsCash, setPostAsCash] = useState(!!existingCash);
    const [postAsFF, setPostAsFF] = useState(!!existingFF);
    const [postAsTimeTrade, setPostAsTimeTrade] = useState(!!existingTimeTrade);
    const [tradeCash, setTradeCash] = useState(
        existingTrade?.cash_amount?.toString() ?? '',
    );
    const [cashAmount, setCashAmount] = useState(
        existingCash?.cash_amount?.toString() ?? '',
    );
    const [ffCash, setFfCash] = useState(
        existingFF?.cash_amount?.toString() ?? '',
    );
    const [ffMinutes, setFfMinutes] = useState(
        existingFF?.flight_follow_minutes?.toString() ?? '90',
    );
    const [ffAt, setFfAt] = useState<'beginning' | 'end'>(
        existingFF?.flight_follow_at === 'end' ? 'end' : 'beginning',
    );
    const [timeTradeCash, setTimeTradeCash] = useState(
        existingTimeTrade?.cash_amount?.toString() ?? '',
    );
    const [preferredStartTimes, setPreferredStartTimes] = useState<string[]>(
        () =>
            existingTimeTrade?.preferred_start_times &&
            Array.isArray(existingTimeTrade.preferred_start_times)
                ? [...existingTimeTrade.preferred_start_times]
                : [],
    );
    const [preferredDeskType, setPreferredDeskType] = useState<string | ''>(
        existingTimeTrade?.preferred_desk_type ?? '',
    );
    const [allowCounterOffers, setAllowCounterOffers] = useState(
        !!existingCash?.allow_counter_offers,
    );
    const [paybackDateRanges, setPaybackDateRanges] = useState<
        PaybackDateRange[]
    >(() => {
        const ranges = existingTrade?.payback_date_ranges;
        if (Array.isArray(ranges) && ranges.length > 0) {
            return ranges
                .map((r) => ({ start: r.start ?? '', end: r.end ?? '' }))
                .filter((r) => r.start && r.end);
        }
        return [];
    });
    const [notes, setNotes] = useState(
        existingTrade?.notes ??
            existingCash?.notes ??
            existingFF?.notes ??
            existingTimeTrade?.notes ??
            '',
    );
    const [saving, setSaving] = useState(false);
    const [showConfirmRemovePost, setShowConfirmRemovePost] = useState(false);
    const [removingPost, setRemovingPost] = useState(false);
    const [history, setHistory] = useState<
        {
            changed_at: string;
            post_type?: string;
            changes: { field: string; old: unknown; new: unknown }[];
        }[]
    >([]);

    const hasExisting =
        !!existingTrade ||
        !!existingCash ||
        !!existingFF ||
        !!existingTimeTrade;

    useEffect(() => {
        if (open && preselectFlightFollow && !existingFF) {
            setPostAsFF(true);
            setPostAsTrade(false);
            setPostAsCash(false);
        }
    }, [open, preselectFlightFollow, existingFF]);

    useEffect(() => {
        if (!open) return;
        if (
            existingTimeTrade?.preferred_start_times &&
            Array.isArray(existingTimeTrade.preferred_start_times)
        ) {
            setPreferredStartTimes([
                ...existingTimeTrade.preferred_start_times,
            ]);
        } else {
            setPreferredStartTimes([]);
        }
        setPreferredDeskType(existingTimeTrade?.preferred_desk_type ?? '');
    }, [
        open,
        existingTimeTrade?.preferred_start_times,
        existingTimeTrade?.preferred_desk_type,
    ]);

    useEffect(() => {
        if (!open) return;
        const ranges = existingTrade?.payback_date_ranges;
        if (Array.isArray(ranges) && ranges.length > 0) {
            setPaybackDateRanges(
                ranges
                    .map((r) => ({ start: r.start ?? '', end: r.end ?? '' }))
                    .filter((r) => r.start && r.end),
            );
        } else {
            setPaybackDateRanges([]);
        }
    }, [open, existingTrade?.payback_date_ranges]);

    useEffect(() => {
        if (!open) return;
        setAllowCounterOffers(!!existingCash?.allow_counter_offers);
    }, [open, existingCash?.allow_counter_offers]);

    useEffect(() => {
        if (!open || !shift.shiftId) return;
        fetch(`/api/shifts/${shift.shiftId}/post-history`, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        })
            .then((r) => (r.ok ? r.json() : { history: [] }))
            .then((data) =>
                setHistory(Array.isArray(data.history) ? data.history : []),
            )
            .catch(() => setHistory([]));
    }, [open, shift.shiftId]);

    const handleRemovePost = async () => {
        if (safePosts.length === 0) return;
        setRemovingPost(true);
        try {
            const res = await fetch(`/api/shifts/${shift.shiftId}/postings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    postings: [],
                    delete_ids: safePosts.map((p) => p.id),
                }),
            });
            if (res.ok) {
                setShowConfirmRemovePost(false);
                onOpenChange(false);
                onSuccess();
            }
        } finally {
            setRemovingPost(false);
        }
    };

    const handleTradeChange = (checked: boolean) => {
        setPostAsTrade(checked);
        if (checked) {
            setPostAsFF(false);
            setPostAsTimeTrade(false);
        }
    };
    const handleCashChange = (checked: boolean) => {
        setPostAsCash(checked);
        if (checked) {
            setPostAsFF(false);
            setPostAsTimeTrade(false);
        }
    };
    const handleFFChange = (checked: boolean) => {
        setPostAsFF(checked);
        if (checked) {
            setPostAsTrade(false);
            setPostAsCash(false);
            setPostAsTimeTrade(false);
        }
    };
    const handleTimeTradeChange = (checked: boolean) => {
        setPostAsTimeTrade(checked);
        if (checked) {
            setPostAsTrade(false);
            setPostAsCash(false);
            setPostAsFF(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!postAsTrade && !postAsCash && !postAsFF && !postAsTimeTrade)
            return;
        setSaving(true);
        const postings: {
            type: string;
            cash_amount?: number;
            flight_follow_minutes?: number;
            notes?: string;
            preferred_start_times?: string[];
            preferred_desk_type?: string;
            payback_date_ranges?: PaybackDateRange[];
            allow_counter_offers?: boolean;
        }[] = [];
        const validPaybackRanges = paybackDateRanges.filter(
            (r) => r.start && r.end,
        );
        if (postAsTrade) {
            postings.push({
                type: 'trade',
                cash_amount: tradeCash ? parseFloat(tradeCash) : undefined,
                notes: notes || undefined,
                payback_date_ranges:
                    validPaybackRanges.length > 0
                        ? validPaybackRanges
                        : undefined,
            });
        }
        if (postAsTimeTrade) {
            postings.push({
                type: 'time_trade',
                cash_amount: timeTradeCash
                    ? parseFloat(timeTradeCash)
                    : undefined,
                notes: notes || undefined,
                preferred_start_times:
                    preferredStartTimes.length > 0
                        ? preferredStartTimes
                        : undefined,
                preferred_desk_type: preferredDeskType || undefined,
            });
        }
        if (postAsCash) {
            postings.push({
                type: 'cash',
                cash_amount: cashAmount ? parseFloat(cashAmount) : undefined,
                notes: notes || undefined,
                allow_counter_offers: allowCounterOffers,
            });
        }
        if (postAsFF) {
            postings.push({
                type: 'flight_follow',
                cash_amount: ffCash ? parseFloat(ffCash) : undefined,
                flight_follow_minutes: ffMinutes
                    ? parseInt(ffMinutes, 10)
                    : undefined,
                flight_follow_at: ffAt,
                notes: notes || undefined,
            });
        }
        const deleteIds = [
            ...(!postAsTrade && existingTrade ? [existingTrade.id] : []),
            ...(!postAsTimeTrade && existingTimeTrade
                ? [existingTimeTrade.id]
                : []),
            ...(!postAsCash && existingCash ? [existingCash.id] : []),
            ...(!postAsFF && existingFF ? [existingFF.id] : []),
        ];
        try {
            const res = await fetch(`/api/shifts/${shift.shiftId}/postings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ postings, delete_ids: deleteIds }),
            });
            if (res.ok) {
                onSuccess();
                onOpenChange(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const timeStr = (() => {
        try {
            const s = shift.start != null ? new Date(shift.start) : null;
            const e = shift.end != null ? new Date(shift.end) : null;
            if (
                !s ||
                !e ||
                Number.isNaN(s.getTime()) ||
                Number.isNaN(e.getTime())
            )
                return '';
            return `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } catch {
            return '';
        }
    })();

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {hasExisting ? <Edit className="h-5 w-5" /> : null}
                            {hasExisting ? 'Edit posted shift' : 'Post shift'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">
                                    Shift
                                </div>
                                <div className="font-semibold">
                                    {shift.position_name}
                                </div>
                                {shift.desk_type && (
                                    <div className="text-xs text-muted-foreground">
                                        Desk type:{' '}
                                        {shift.workgroup_id != null
                                            ? (workgroups
                                                  .find(
                                                      (w) =>
                                                          w.id ===
                                                          shift.workgroup_id,
                                                  )
                                                  ?.desk_types?.find(
                                                      (d) =>
                                                          d.code ===
                                                          shift.desk_type,
                                                  )?.label ??
                                              DESK_TYPE_LABELS[
                                                  shift.desk_type
                                              ] ??
                                              shift.desk_type)
                                            : (DESK_TYPE_LABELS[
                                                  shift.desk_type
                                              ] ?? shift.desk_type)}
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                    {timeStr}
                                    {shift.workgroup_name
                                        ? ` · ${shift.workgroup_name}`
                                        : ''}
                                </div>
                            </div>

                            {postAsFF && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                    <Info className="mt-0.5 size-4 shrink-0" />
                                    <p>
                                        Flight following cannot be combined with
                                        trade, time trade, or giveaway for this
                                        shift.
                                        {(existingTrade ||
                                            existingCash ||
                                            existingTimeTrade) && (
                                            <>
                                                {' '}
                                                Selecting flight following will
                                                deactivate your current post for
                                                this shift.
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}
                            {(postAsTrade || postAsCash || postAsTimeTrade) &&
                                existingFF && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                        <Info className="mt-0.5 size-4 shrink-0" />
                                        <p>
                                            Trade, time trade, and giveaway
                                            cannot be combined with flight
                                            following. Selecting one will
                                            deactivate your current flight
                                            following post.
                                        </p>
                                    </div>
                                )}
                            {postAsTimeTrade && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                    <Info className="mt-0.5 size-4 shrink-0" />
                                    <p>
                                        Time trade cannot be combined with
                                        trade, giveaway, or flight following for
                                        this shift.
                                        {(existingTrade ||
                                            existingCash ||
                                            existingFF) && (
                                            <>
                                                {' '}
                                                Selecting time trade will
                                                deactivate your current post for
                                                this shift.
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}
                            {(postAsTrade || postAsCash || postAsFF) &&
                                existingTimeTrade && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                        <Info className="mt-0.5 size-4 shrink-0" />
                                        <p>
                                            Trade, giveaway, and flight
                                            following cannot be combined with
                                            time trade. Selecting one will
                                            deactivate your current time trade
                                            post.
                                        </p>
                                    </div>
                                )}

                            <div className="space-y-3">
                                <Label>Posting types</Label>
                                {isTraining && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                        <Info className="mt-0.5 size-4 shrink-0" />
                                        <p>
                                            Training shift – no posting allowed.
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div
                                        onClick={(e) => {
                                            if (isTraining) return;
                                            if (
                                                (
                                                    e.target as HTMLElement
                                                ).closest(
                                                    '[data-slot="checkbox"], input[type="checkbox"]',
                                                )
                                            )
                                                return;
                                            handleTradeChange(!postAsTrade);
                                        }}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                            !isTraining && 'cursor-pointer',
                                            postAsTrade
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50',
                                            isTraining && 'opacity-60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={postAsTrade}
                                            onChange={(e) =>
                                                !isTraining &&
                                                handleTradeChange(
                                                    e.target.checked,
                                                )
                                            }
                                            disabled={isTraining}
                                            className={cn(
                                                'size-4 shrink-0 rounded-[4px] border border-input shadow-xs',
                                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                                postAsTrade &&
                                                    'border-primary bg-primary text-primary-foreground',
                                            )}
                                            aria-label="Post as trade"
                                        />
                                        <div className="flex-1">
                                            <Label className="flex cursor-pointer items-center gap-2 font-medium">
                                                <Handshake className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                Trade
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Swap with another team member
                                            </p>
                                            {postAsTrade && (
                                                <>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Cash (optional)
                                                        </Label>
                                                        <div className="relative mt-0.5">
                                                            <DollarSign className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.01}
                                                                value={
                                                                    tradeCash
                                                                }
                                                                onChange={(e) =>
                                                                    setTradeCash(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="0"
                                                                className="h-8 pl-8"
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-2.5"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <Label className="text-xs font-medium">
                                                            Payback date ranges
                                                            (optional)
                                                        </Label>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            When do you want to
                                                            receive a shift
                                                            back? Shown on your
                                                            post; responders see
                                                            shifts in these
                                                            dates first.
                                                        </p>
                                                        <div className="space-y-3">
                                                            {paybackDateRanges.map(
                                                                (
                                                                    range,
                                                                    idx,
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            idx
                                                                        }
                                                                        className="flex max-w-full flex-nowrap items-center gap-1.5"
                                                                    >
                                                                        <Input
                                                                            type="date"
                                                                            value={
                                                                                range.start
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) => {
                                                                                const v =
                                                                                    e
                                                                                        .target
                                                                                        .value;
                                                                                setPaybackDateRanges(
                                                                                    (
                                                                                        prev,
                                                                                    ) => {
                                                                                        const next =
                                                                                            [
                                                                                                ...prev,
                                                                                            ];
                                                                                        next[
                                                                                            idx
                                                                                        ] =
                                                                                            {
                                                                                                ...next[
                                                                                                    idx
                                                                                                ],
                                                                                                start: v,
                                                                                            };
                                                                                        return next;
                                                                                    },
                                                                                );
                                                                            }}
                                                                            className="h-8 w-28 shrink-0 text-sm"
                                                                        />
                                                                        <span className="shrink-0 text-[11px] text-muted-foreground">
                                                                            to
                                                                        </span>
                                                                        <Input
                                                                            type="date"
                                                                            value={
                                                                                range.end
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) => {
                                                                                const v =
                                                                                    e
                                                                                        .target
                                                                                        .value;
                                                                                setPaybackDateRanges(
                                                                                    (
                                                                                        prev,
                                                                                    ) => {
                                                                                        const next =
                                                                                            [
                                                                                                ...prev,
                                                                                            ];
                                                                                        next[
                                                                                            idx
                                                                                        ] =
                                                                                            {
                                                                                                ...next[
                                                                                                    idx
                                                                                                ],
                                                                                                end: v,
                                                                                            };
                                                                                        return next;
                                                                                    },
                                                                                );
                                                                            }}
                                                                            className="h-8 w-28 shrink-0 text-sm"
                                                                        />
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                                                            onClick={() =>
                                                                                setPaybackDateRanges(
                                                                                    (
                                                                                        prev,
                                                                                    ) =>
                                                                                        prev.filter(
                                                                                            (
                                                                                                _,
                                                                                                i,
                                                                                            ) =>
                                                                                                i !==
                                                                                                idx,
                                                                                        ),
                                                                                )
                                                                            }
                                                                            aria-label="Remove range"
                                                                        >
                                                                            <X className="size-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                ),
                                                            )}
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs"
                                                                onClick={() =>
                                                                    setPaybackDateRanges(
                                                                        (
                                                                            prev,
                                                                        ) => [
                                                                            ...prev,
                                                                            {
                                                                                start: '',
                                                                                end: '',
                                                                            },
                                                                        ],
                                                                    )
                                                                }
                                                            >
                                                                Add date range
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        onClick={(e) => {
                                            if (isTraining) return;
                                            if (
                                                (
                                                    e.target as HTMLElement
                                                ).closest(
                                                    '[data-slot="checkbox"], input[type="checkbox"]',
                                                )
                                            )
                                                return;
                                            handleCashChange(!postAsCash);
                                        }}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                            !isTraining && 'cursor-pointer',
                                            postAsCash
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50',
                                            isTraining && 'opacity-60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={postAsCash}
                                            onChange={(e) =>
                                                !isTraining &&
                                                handleCashChange(
                                                    e.target.checked,
                                                )
                                            }
                                            disabled={isTraining}
                                            className={cn(
                                                'size-4 shrink-0 rounded-[4px] border border-input shadow-xs',
                                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                                postAsCash &&
                                                    'border-primary bg-primary text-primary-foreground',
                                            )}
                                            aria-label="Post as giveaway"
                                        />
                                        <div className="flex-1">
                                            <Label className="flex cursor-pointer items-center gap-2 font-medium">
                                                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                Giveaway
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Give away shift, no trade
                                                required
                                            </p>
                                            {postAsCash && (
                                                <div className="mt-2">
                                                    <Label className="text-xs">
                                                        Cash (optional)
                                                    </Label>
                                                    <div className="relative mt-0.5">
                                                        <DollarSign className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            step={0.01}
                                                            value={cashAmount}
                                                            onChange={(e) =>
                                                                setCashAmount(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="0"
                                                            className="h-8 pl-8"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        />
                                                    </div>
                                                    <div
                                                        className="mt-2 flex cursor-pointer items-center gap-2 text-sm select-none"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAllowCounterOffers(
                                                                (v) => !v,
                                                            );
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                allowCounterOffers
                                                            }
                                                            onChange={(e) =>
                                                                setAllowCounterOffers(
                                                                    e.target
                                                                        .checked,
                                                                )
                                                            }
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            className="size-4 rounded border border-input"
                                                        />
                                                        <span>
                                                            Allow counter offers
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-1 space-y-3 border-t border-border pt-1 pt-3">
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Time trade & flight following
                                    </p>
                                    <div
                                        onClick={(e) => {
                                            if (isTraining) return;
                                            if (
                                                (
                                                    e.target as HTMLElement
                                                ).closest(
                                                    '[data-slot="checkbox"], input[type="checkbox"]',
                                                )
                                            )
                                                return;
                                            handleTimeTradeChange(
                                                !postAsTimeTrade,
                                            );
                                        }}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                            !isTraining && 'cursor-pointer',
                                            postAsTimeTrade
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50',
                                            isTraining && 'opacity-60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={postAsTimeTrade}
                                            onChange={(e) =>
                                                !isTraining &&
                                                handleTimeTradeChange(
                                                    e.target.checked,
                                                )
                                            }
                                            disabled={isTraining}
                                            className={cn(
                                                'size-4 shrink-0 rounded-[4px] border border-input shadow-xs',
                                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                                postAsTimeTrade &&
                                                    'border-primary bg-primary text-primary-foreground',
                                            )}
                                            aria-label="Post as time trade"
                                        />
                                        <div className="flex-1">
                                            <Label className="flex cursor-pointer items-center gap-2 font-medium">
                                                <Repeat
                                                    strokeWidth={2.5}
                                                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                                                />
                                                Time trade
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Trade to a more preferable time
                                                (e.g. AM to PM, or later start
                                                same day)
                                            </p>
                                            {postAsTimeTrade && (
                                                <>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Cash (optional)
                                                        </Label>
                                                        <div className="relative mt-0.5">
                                                            <DollarSign className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.01}
                                                                value={
                                                                    timeTradeCash
                                                                }
                                                                onChange={(e) =>
                                                                    setTimeTradeCash(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="0"
                                                                className="h-8 pl-8"
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    {allowedStartTimes.length >
                                                        0 && (
                                                        <div
                                                            className="mt-3"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <Label className="text-xs">
                                                                Preferred start
                                                                times (in order)
                                                            </Label>
                                                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                                e.g. looking for
                                                                7am then 6am
                                                            </p>
                                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                {allowedStartTimes.map(
                                                                    (t) => {
                                                                        const raw =
                                                                            t.start_time;
                                                                        const normalized =
                                                                            normalizeHhmm(
                                                                                raw,
                                                                            );
                                                                        const selected =
                                                                            preferredStartTimes.includes(
                                                                                normalized,
                                                                            );
                                                                        return (
                                                                            <button
                                                                                key={
                                                                                    normalized
                                                                                }
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (
                                                                                        selected
                                                                                    )
                                                                                        return;
                                                                                    setPreferredStartTimes(
                                                                                        (
                                                                                            prev,
                                                                                        ) => [
                                                                                            ...prev,
                                                                                            normalized,
                                                                                        ],
                                                                                    );
                                                                                }}
                                                                                className={cn(
                                                                                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                                                                    selected
                                                                                        ? 'cursor-default border-primary bg-primary/10 text-primary'
                                                                                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                                                                                )}
                                                                                disabled={
                                                                                    selected
                                                                                }
                                                                            >
                                                                                {formatTimeLabel(
                                                                                    normalized,
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                            {preferredStartTimes.length >
                                                                0 && (
                                                                <ul className="mt-2 space-y-1">
                                                                    {preferredStartTimes.map(
                                                                        (
                                                                            t,
                                                                            i,
                                                                        ) => (
                                                                            <li
                                                                                key={`${t}-${i}`}
                                                                                className="flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1 text-xs"
                                                                            >
                                                                                <span className="w-4 text-muted-foreground">
                                                                                    {i +
                                                                                        1}
                                                                                    .
                                                                                </span>
                                                                                <span className="flex-1">
                                                                                    {formatTimeLabel(
                                                                                        t,
                                                                                    )}
                                                                                </span>
                                                                                <div className="flex items-center gap-0.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="rounded p-0.5 hover:bg-muted"
                                                                                        onClick={() =>
                                                                                            setPreferredStartTimes(
                                                                                                (
                                                                                                    prev,
                                                                                                ) => {
                                                                                                    if (
                                                                                                        i <=
                                                                                                        0
                                                                                                    )
                                                                                                        return prev;
                                                                                                    const next =
                                                                                                        [
                                                                                                            ...prev,
                                                                                                        ];
                                                                                                    [
                                                                                                        next[
                                                                                                            i -
                                                                                                                1
                                                                                                        ],
                                                                                                        next[
                                                                                                            i
                                                                                                        ],
                                                                                                    ] =
                                                                                                        [
                                                                                                            next[
                                                                                                                i
                                                                                                            ],
                                                                                                            next[
                                                                                                                i -
                                                                                                                    1
                                                                                                            ],
                                                                                                        ];
                                                                                                    return next;
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                        aria-label="Move up"
                                                                                    >
                                                                                        <ChevronUp className="size-3.5" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="rounded p-0.5 hover:bg-muted"
                                                                                        onClick={() =>
                                                                                            setPreferredStartTimes(
                                                                                                (
                                                                                                    prev,
                                                                                                ) => {
                                                                                                    if (
                                                                                                        i >=
                                                                                                        prev.length -
                                                                                                            1
                                                                                                    )
                                                                                                        return prev;
                                                                                                    const next =
                                                                                                        [
                                                                                                            ...prev,
                                                                                                        ];
                                                                                                    [
                                                                                                        next[
                                                                                                            i
                                                                                                        ],
                                                                                                        next[
                                                                                                            i +
                                                                                                                1
                                                                                                        ],
                                                                                                    ] =
                                                                                                        [
                                                                                                            next[
                                                                                                                i +
                                                                                                                    1
                                                                                                            ],
                                                                                                            next[
                                                                                                                i
                                                                                                            ],
                                                                                                        ];
                                                                                                    return next;
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                        aria-label="Move down"
                                                                                    >
                                                                                        <ChevronDown className="size-3.5" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="rounded p-0.5 hover:bg-destructive/20 hover:text-destructive"
                                                                                        onClick={() =>
                                                                                            setPreferredStartTimes(
                                                                                                (
                                                                                                    prev,
                                                                                                ) =>
                                                                                                    prev.filter(
                                                                                                        (
                                                                                                            _,
                                                                                                            j,
                                                                                                        ) =>
                                                                                                            j !==
                                                                                                            i,
                                                                                                    ),
                                                                                            )
                                                                                        }
                                                                                        aria-label="Remove"
                                                                                    >
                                                                                        <X className="size-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div
                                                        className="mt-3"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <Label className="text-xs">
                                                            Preferred desk type
                                                            (optional)
                                                        </Label>
                                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                            If you&apos;re
                                                            hoping to move to a
                                                            different desk, pick
                                                            it here. Leave blank
                                                            for any desk.
                                                        </p>
                                                        <select
                                                            value={
                                                                preferredDeskType
                                                            }
                                                            onChange={(e) =>
                                                                setPreferredDeskType(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                                        >
                                                            <option value="">
                                                                Any desk type
                                                            </option>
                                                            {(() => {
                                                                const wg =
                                                                    shift.workgroup_id !=
                                                                    null
                                                                        ? workgroups.find(
                                                                              (
                                                                                  w,
                                                                              ) =>
                                                                                  w.id ===
                                                                                  shift.workgroup_id,
                                                                          )
                                                                        : null;
                                                                const deskTypes =
                                                                    wg?.desk_types ??
                                                                    [];
                                                                return deskTypes.map(
                                                                    (d) => (
                                                                        <option
                                                                            key={
                                                                                d.code
                                                                            }
                                                                            value={
                                                                                d.code
                                                                            }
                                                                        >
                                                                            {
                                                                                d.label
                                                                            }
                                                                        </option>
                                                                    ),
                                                                );
                                                            })()}
                                                        </select>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        onClick={(e) => {
                                            if (isTraining) return;
                                            if (
                                                (
                                                    e.target as HTMLElement
                                                ).closest(
                                                    '[data-slot="checkbox"], input[type="checkbox"]',
                                                )
                                            )
                                                return;
                                            handleFFChange(!postAsFF);
                                        }}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                            !isTraining && 'cursor-pointer',
                                            postAsFF
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50',
                                            isTraining && 'opacity-60',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={postAsFF}
                                            onChange={(e) =>
                                                !isTraining &&
                                                handleFFChange(e.target.checked)
                                            }
                                            disabled={isTraining}
                                            className={cn(
                                                'size-4 shrink-0 rounded-[4px] border border-input shadow-xs',
                                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                                postAsFF &&
                                                    'border-primary bg-primary text-primary-foreground',
                                            )}
                                            aria-label="Post as flight following"
                                        />
                                        <div className="flex-1">
                                            <Label className="flex cursor-pointer items-center gap-2 font-medium">
                                                <Plane className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                Flight following
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Cover only part of this shift
                                            </p>
                                            {postAsFF && (
                                                <>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Minutes to cover
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={600}
                                                            value={ffMinutes}
                                                            onChange={(e) =>
                                                                setFfMinutes(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="mt-0.5 h-8 w-24"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        />
                                                    </div>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Flight follower
                                                            requested at
                                                        </Label>
                                                        <div
                                                            className="mt-1 flex gap-3"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <Label className="flex cursor-pointer items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="ff_at"
                                                                    checked={
                                                                        ffAt ===
                                                                        'beginning'
                                                                    }
                                                                    onChange={() =>
                                                                        setFfAt(
                                                                            'beginning',
                                                                        )
                                                                    }
                                                                    className="size-3.5"
                                                                />
                                                                <span className="text-sm">
                                                                    Beginning of
                                                                    shift
                                                                </span>
                                                            </Label>
                                                            <Label className="flex cursor-pointer items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="ff_at"
                                                                    checked={
                                                                        ffAt ===
                                                                        'end'
                                                                    }
                                                                    onChange={() =>
                                                                        setFfAt(
                                                                            'end',
                                                                        )
                                                                    }
                                                                    className="size-3.5"
                                                                />
                                                                <span className="text-sm">
                                                                    End of shift
                                                                </span>
                                                            </Label>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Cash (optional)
                                                        </Label>
                                                        <div className="relative mt-0.5">
                                                            <DollarSign className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.01}
                                                                value={ffCash}
                                                                onChange={(e) =>
                                                                    setFfCash(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="0"
                                                                className="h-8 pl-8"
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="post-notes">Notes</Label>
                                <Textarea
                                    id="post-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Requirements or details..."
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>

                            {history.length > 0 && (
                                <div className="rounded-lg border border-border bg-muted/30 p-2">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <History className="size-3.5" />
                                        Edit history
                                    </div>
                                    <ul className="mt-1.5 max-h-32 space-y-1.5 overflow-y-auto text-xs">
                                        {history.map((h, i) => (
                                            <li
                                                key={i}
                                                className="border-l-2 border-muted-foreground/30 pl-2"
                                            >
                                                <span className="text-muted-foreground">
                                                    {h.changed_at
                                                        ? new Date(
                                                              h.changed_at,
                                                          ).toLocaleString()
                                                        : ''}
                                                    {h.post_type &&
                                                        ` · ${h.post_type.replace('_', ' ')}`}
                                                </span>
                                                <ul className="mt-0.5 space-y-0.5">
                                                    {(h.changes || []).map(
                                                        (c, j) => {
                                                            const label =
                                                                c.field ===
                                                                'cash_amount'
                                                                    ? 'Cash amount'
                                                                    : c.field ===
                                                                        'flight_follow_minutes'
                                                                      ? 'Minutes to cover'
                                                                      : c.field ===
                                                                          'flight_follow_at'
                                                                        ? 'Flight follower at'
                                                                        : c.field ===
                                                                            'notes'
                                                                          ? 'Notes'
                                                                          : c.field;
                                                            const oldStr =
                                                                c.old != null &&
                                                                c.old !== ''
                                                                    ? c.field ===
                                                                      'cash_amount'
                                                                        ? `$${c.old}`
                                                                        : String(
                                                                              c.old,
                                                                          )
                                                                    : '(empty)';
                                                            const newStr =
                                                                c.new != null &&
                                                                c.new !== ''
                                                                    ? c.field ===
                                                                      'cash_amount'
                                                                        ? `$${c.new}`
                                                                        : String(
                                                                              c.new,
                                                                          )
                                                                    : '(empty)';
                                                            return (
                                                                <li
                                                                    key={j}
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {label}:{' '}
                                                                    {oldStr} →{' '}
                                                                    {newStr}
                                                                </li>
                                                            );
                                                        },
                                                    )}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                            {hasExisting && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="order-3 w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive sm:order-1 sm:mr-auto sm:w-auto"
                                    onClick={() =>
                                        setShowConfirmRemovePost(true)
                                    }
                                >
                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                    Remove post
                                </Button>
                            )}
                            <div className="order-4 flex w-full flex-wrap items-center justify-end gap-2 sm:order-2 sm:w-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        saving ||
                                        isTraining ||
                                        (!postAsTrade &&
                                            !postAsCash &&
                                            !postAsFF &&
                                            !postAsTimeTrade)
                                    }
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    {hasExisting ? 'Update' : 'Post'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showConfirmRemovePost}
                onOpenChange={setShowConfirmRemovePost}
            >
                <DialogContent
                    className="sm:max-w-md"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle>Remove post?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will remove all postings for this shift. The shift
                        will stay on your schedule; you just won’t be offering
                        it for trade, giveaway, or flight following anymore.
                    </p>
                    <DialogFooter className="gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowConfirmRemovePost(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={removingPost}
                            onClick={handleRemovePost}
                        >
                            {removingPost ? 'Removing…' : 'Remove post'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
