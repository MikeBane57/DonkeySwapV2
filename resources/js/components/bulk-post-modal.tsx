import { Handshake, Gift, DollarSign, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PaybackDateRange } from '@/components/post-shift-modal';
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

type BulkPostModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shiftIds: number[];
    shiftCountLabel?: string;
    onSuccess: () => void;
};

export function BulkPostModal({
    open,
    onOpenChange,
    shiftIds,
    shiftCountLabel,
    onSuccess,
}: BulkPostModalProps) {
    const [postAsTrade, setPostAsTrade] = useState(true);
    const [postAsGiveaway, setPostAsGiveaway] = useState(false);
    const [tradeCash, setTradeCash] = useState('');
    const [cashAmount, setCashAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [paybackDateRanges, setPaybackDateRanges] = useState<
        PaybackDateRange[]
    >([]);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (open) setSubmitError(null);
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!postAsTrade && !postAsGiveaway) return;
        setSaving(true);
        setSubmitError(null);
        const validPaybackRanges = paybackDateRanges.filter(
            (r) => r.start && r.end,
        );
        const postings: {
            type: string;
            cash_amount?: number;
            notes?: string;
            payback_date_ranges?: PaybackDateRange[];
        }[] = [];
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
        if (postAsGiveaway) {
            postings.push({
                type: 'cash',
                cash_amount: cashAmount ? parseFloat(cashAmount) : undefined,
                notes: notes || undefined,
            });
        }
        try {
            const res = await fetch('/api/postings/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ shift_ids: shiftIds, postings }),
            });
            if (res.ok) {
                onSuccess();
                onOpenChange(false);
            } else {
                const data = await res.json().catch(() => ({}));
                setSubmitError(
                    data.message ??
                        data.errors?.postings?.[0] ??
                        `Request failed (${res.status}). Try again.`,
                );
            }
        } catch {
            setSubmitError(
                'Network error. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>
                        Post {shiftIds.length} shift
                        {shiftIds.length !== 1 ? 's' : ''} in bulk
                    </DialogTitle>
                </DialogHeader>
                {shiftCountLabel && (
                    <p className="text-sm text-muted-foreground">
                        {shiftCountLabel}
                    </p>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2">
                        <div className="space-y-3">
                            <Label>Posting type (choose one or both)</Label>
                            <label
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                    postAsTrade
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={postAsTrade}
                                    onChange={(e) =>
                                        setPostAsTrade(e.target.checked)
                                    }
                                    className="mt-1 size-4 shrink-0 rounded border border-input"
                                    aria-label="Post as trade"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 font-medium">
                                        <Handshake className="h-4 w-4 shrink-0 text-blue-600" />
                                        Trade
                                    </span>
                                    {postAsTrade && (
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
                                                    value={tradeCash}
                                                    onChange={(e) =>
                                                        setTradeCash(
                                                            e.target.value,
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
                                                    When do you want to receive
                                                    a shift back? Shown on your
                                                    post; responders see shifts
                                                    in these dates first.
                                                </p>
                                                <div className="space-y-3">
                                                    {paybackDateRanges.map(
                                                        (range, idx) => (
                                                            <div
                                                                key={idx}
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
                                                                (prev) => [
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
                                        </div>
                                    )}
                                </div>
                            </label>
                            <label
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                    postAsGiveaway
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={postAsGiveaway}
                                    onChange={(e) =>
                                        setPostAsGiveaway(e.target.checked)
                                    }
                                    className="mt-1 size-4 shrink-0 rounded border border-input"
                                    aria-label="Post as giveaway"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 font-medium">
                                        <Gift className="h-4 w-4 shrink-0 text-green-600" />
                                        Giveaway
                                    </span>
                                    {postAsGiveaway && (
                                        <div className="mt-2">
                                            <Label className="text-xs">
                                                Amount
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
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-8 pl-8"
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                        {submitError && (
                            <p className="text-sm text-destructive">
                                {submitError}
                            </p>
                        )}
                        <div>
                            <Label className="text-xs">
                                Notes (optional, same for all)
                            </Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notes"
                                className="mt-1 min-h-[60px]"
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving
                                ? 'Posting…'
                                : `Post ${shiftIds.length} shift${shiftIds.length !== 1 ? 's' : ''}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
