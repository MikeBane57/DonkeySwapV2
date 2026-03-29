import { Plane } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCsrfToken } from '@/lib/csrf';

type Workgroup = {
    id: number;
    name: string;
    desk_types?: { code: string; label: string }[];
};

export type PostLfwModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate: string;
    defaultWillingToFollow?: boolean;
    /** When willing to follow: before, after, or any */
    defaultWillingToFollowTimeFrame?: 'before' | 'after' | 'any' | null;
    workgroups: Workgroup[];
    /**
     * When set, posts the same details for each date (e.g. puck “post all”).
     * Hides the single-date picker; shows a summary list instead.
     */
    bulkDates?: string[];
    onSuccess?: () => void;
};

const SLOT_LABELS: Record<string, string> = {
    before_am: 'Before · AM',
    before_pm: 'Before · PM',
    before_mid: 'Before · Mid',
    after_am: 'After · AM',
    after_pm: 'After · PM',
    after_mid: 'After · Mid',
};

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

export function PostLfwModal({
    open,
    onOpenChange,
    defaultDate,
    defaultWillingToFollow = false,
    defaultWillingToFollowTimeFrame = null,
    workgroups,
    bulkDates,
    onSuccess,
}: PostLfwModalProps) {
    const isBulk = (bulkDates?.length ?? 0) > 0;
    const [step, setStep] = useState<'edit' | 'review'>('edit');
    const [date, setDate] = useState(defaultDate);
    const [deskTypes, setDeskTypes] = useState<string[]>([]);
    const [cash, setCash] = useState('');
    const [obo, setObo] = useState(false);
    const [willingToFollow, setWillingToFollow] = useState(
        defaultWillingToFollow,
    );
    const [haveShiftOnDate, setHaveShiftOnDate] = useState<boolean | null>(
        defaultWillingToFollowTimeFrame != null &&
            defaultWillingToFollowTimeFrame !== 'any'
            ? true
            : null,
    );
    const [willingToFollowTimeFrame, setWillingToFollowTimeFrame] = useState<
        'before' | 'after' | 'any' | ''
    >(defaultWillingToFollowTimeFrame ?? 'any');
    const [willingToFollowSlots, setWillingToFollowSlots] = useState<string[]>(
        [],
    );
    const [willingToFollowCustom, setWillingToFollowCustom] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setStep('edit');
            setDate(
                defaultDate?.trim() || bulkDates?.[0]?.trim() || todayStr(),
            );
            setWillingToFollow(defaultWillingToFollow);
            setHaveShiftOnDate(
                defaultWillingToFollowTimeFrame != null &&
                    defaultWillingToFollowTimeFrame !== 'any'
                    ? true
                    : null,
            );
            setWillingToFollowTimeFrame(
                defaultWillingToFollowTimeFrame ?? 'any',
            );
            setWillingToFollowSlots([]);
            setWillingToFollowCustom('');
            setDeskTypes([]);
            setCash('');
            setObo(false);
            setNotes('');
            setError(null);
        }
    }, [
        open,
        defaultDate,
        defaultWillingToFollow,
        defaultWillingToFollowTimeFrame,
        bulkDates,
    ]);

    const deskTypeOptions = useMemo(() => {
        const seen = new Set<string>();
        const out: { code: string; label: string }[] = [];
        for (const wg of workgroups) {
            for (const d of wg.desk_types ?? []) {
                if (!seen.has(d.code)) {
                    seen.add(d.code);
                    out.push({ code: d.code, label: d.label ?? d.code });
                }
            }
        }
        return out;
    }, [workgroups]);

    const codeToLabel = useMemo(() => {
        const m = new Map<string, string>();
        for (const o of deskTypeOptions) m.set(o.code, o.label);
        return m;
    }, [deskTypeOptions]);

    function buildPayload(seekingDate: string): Record<string, unknown> {
        return {
            seeking_date: seekingDate,
            seeking_desk_types: deskTypes.length ? deskTypes : null,
            seeking_cash: Number(cash),
            seeking_obo: obo,
            notes: notes.trim() || null,
            willing_to_follow: willingToFollow,
            willing_to_follow_time_frame:
                willingToFollow && haveShiftOnDate === true
                    ? willingToFollowTimeFrame === ''
                        ? 'any'
                        : willingToFollowTimeFrame
                    : null,
            willing_to_follow_slots:
                willingToFollow &&
                haveShiftOnDate === false &&
                willingToFollowSlots.length > 0
                    ? willingToFollowSlots
                    : null,
            willing_to_follow_custom:
                willingToFollow &&
                haveShiftOnDate === false &&
                willingToFollowCustom.trim()
                    ? willingToFollowCustom.trim()
                    : null,
        };
    }

    function validateEdit(): string | null {
        if (isBulk && (!bulkDates || bulkDates.length === 0)) {
            return 'No dates selected.';
        }
        if (!isBulk && !date?.trim()) {
            return 'Choose a date.';
        }
        if (!cash.trim() || Number(cash) < 0) {
            return 'Cash amount is required (use 0 if none).';
        }
        if (willingToFollow && haveShiftOnDate === null) {
            return 'Flight following: say whether you have a shift on that date (Yes / No).';
        }
        if (
            willingToFollow &&
            haveShiftOnDate === false &&
            willingToFollowSlots.length === 0 &&
            !willingToFollowCustom.trim()
        ) {
            return 'When willing to follow without a shift that day, pick at least one time slot or describe availability.';
        }
        return null;
    }

    const goReview = () => {
        const v = validateEdit();
        if (v) {
            setError(v);
            return;
        }
        setError(null);
        setStep('review');
    };

    const handleSubmit = async () => {
        const v = validateEdit();
        if (v) {
            setError(v);
            setStep('edit');
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const dates = isBulk ? bulkDates! : [date];
            for (const seekingDate of dates) {
                const res = await fetch('/api/looking-for-work/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'include',
                    body: JSON.stringify(buildPayload(seekingDate)),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.ok) {
                    setError(
                        (data as { message?: string }).message ||
                            (res.status === 422
                                ? 'Validation failed.'
                                : `Failed for ${seekingDate}.`),
                    );
                    return;
                }
            }
            onSuccess?.();
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    const reviewDeskSummary =
        deskTypes.length === 0
            ? 'Any desk type'
            : deskTypes.map((c) => codeToLabel.get(c) ?? c).join(', ');

    const reviewFfSummary = !willingToFollow
        ? 'Not offering flight follow'
        : haveShiftOnDate === true
          ? `With a shift that day · ${willingToFollowTimeFrame === '' || willingToFollowTimeFrame === 'any' ? 'Any window' : willingToFollowTimeFrame === 'before' ? 'Before my shift' : 'After my shift'}`
          : haveShiftOnDate === false
            ? [
                  willingToFollowSlots
                      .map((s) => SLOT_LABELS[s] ?? s)
                      .join(', '),
                  willingToFollowCustom.trim() || null,
              ]
                  .filter(Boolean)
                  .join(' · ') || '—'
            : '—';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'review'
                            ? 'Review & post'
                            : isBulk
                              ? `Post “Looking for work” (${bulkDates!.length} dates)`
                              : 'Post “Looking for work”'}
                    </DialogTitle>
                </DialogHeader>
                {step === 'review' ? (
                    <div className="space-y-4">
                        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                            {isBulk ? (
                                <div>
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Dates
                                    </p>
                                    <p className="mt-1 max-h-32 overflow-y-auto text-foreground">
                                        {bulkDates!.join(', ')}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Date
                                    </p>
                                    <p className="mt-1 font-medium">{date}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Desk types
                                </p>
                                <p className="mt-1">{reviewDeskSummary}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Cash
                                </p>
                                <p className="mt-1">
                                    ${cash || '0'}
                                    {obo ? ' · OBO' : ''}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Flight following
                                </p>
                                <p className="mt-1">{reviewFfSummary}</p>
                            </div>
                            {notes.trim() ? (
                                <div>
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Notes
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap">
                                        {notes.trim()}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                variant="outline"
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                    setError(null);
                                    setStep('edit');
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                type="button"
                                disabled={submitting}
                                onClick={() => void handleSubmit()}
                            >
                                {submitting
                                    ? '…'
                                    : isBulk
                                      ? `Post ${bulkDates!.length} dates`
                                      : 'Post'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                Full shift
                            </p>
                            {isBulk ? (
                                <div>
                                    <Label>Dates</Label>
                                    <p className="mt-1 max-h-28 overflow-y-auto rounded-md border border-border bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
                                        {bulkDates!.join(', ')}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <Label>Date you want to work</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) =>
                                            setDate(e.target.value)
                                        }
                                        className="mt-1"
                                        min={todayStr()}
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Desk types (optional)</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {deskTypeOptions.map((dt) => (
                                        <label
                                            key={dt.code}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Checkbox
                                                checked={deskTypes.includes(
                                                    dt.code,
                                                )}
                                                onCheckedChange={(c) =>
                                                    setDeskTypes((prev) =>
                                                        c
                                                            ? [...prev, dt.code]
                                                            : prev.filter(
                                                                  (x) =>
                                                                      x !==
                                                                      dt.code,
                                                              ),
                                                    )
                                                }
                                            />
                                            {dt.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label>Cash amount ($)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={cash}
                                    onChange={(e) => setCash(e.target.value)}
                                    className="mt-1"
                                    placeholder="e.g. 500 (0 if none)"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={obo}
                                    onCheckedChange={(c) => setObo(!!c)}
                                />
                                Or best offer (OBO) — responders can offer more
                                or less
                            </label>
                            <div>
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="mt-1"
                                    rows={2}
                                    placeholder="e.g. Prefer morning"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-border pt-3">
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                Flight following
                            </p>
                            <div
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                                    willingToFollow
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                }`}
                                onClick={(e) => {
                                    if (
                                        (e.target as HTMLElement).closest(
                                            'select, input[type="checkbox"], input[type="text"], textarea',
                                        )
                                    )
                                        return;
                                    setWillingToFollow(!willingToFollow);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={willingToFollow}
                                    onChange={(e) =>
                                        setWillingToFollow(e.target.checked)
                                    }
                                    className="size-4 shrink-0 rounded border border-input"
                                    aria-label="Willing to follow (flight following)"
                                />
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <Label className="flex items-center gap-2 font-medium">
                                            <Plane className="size-4 shrink-0 text-purple-600 dark:text-purple-400" />
                                            Willing to follow
                                        </Label>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            You can cover part of a shift.
                                            Subject to 10-hour duty day and
                                            8-hour rest before shift start.
                                        </p>
                                    </div>
                                    {willingToFollow && (
                                        <div
                                            className="space-y-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div>
                                                <Label className="text-xs">
                                                    Do you have a shift on this
                                                    date?
                                                </Label>
                                                <div className="mt-1.5 flex gap-3">
                                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="have_shift"
                                                            checked={
                                                                haveShiftOnDate ===
                                                                true
                                                            }
                                                            onChange={() =>
                                                                setHaveShiftOnDate(
                                                                    true,
                                                                )
                                                            }
                                                            className="size-3.5"
                                                        />
                                                        Yes
                                                    </label>
                                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="have_shift"
                                                            checked={
                                                                haveShiftOnDate ===
                                                                false
                                                            }
                                                            onChange={() =>
                                                                setHaveShiftOnDate(
                                                                    false,
                                                                )
                                                            }
                                                            className="size-3.5"
                                                        />
                                                        No
                                                    </label>
                                                </div>
                                            </div>
                                            {haveShiftOnDate === true && (
                                                <div>
                                                    <Label className="text-xs">
                                                        When you&apos;re
                                                        available (up to 10
                                                        hours)
                                                    </Label>
                                                    <select
                                                        value={
                                                            willingToFollowTimeFrame ||
                                                            'any'
                                                        }
                                                        onChange={(e) =>
                                                            setWillingToFollowTimeFrame(
                                                                (e.target
                                                                    .value ||
                                                                    'any') as
                                                                    | 'before'
                                                                    | 'after'
                                                                    | 'any'
                                                                    | '',
                                                            )
                                                        }
                                                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                                    >
                                                        <option value="any">
                                                            Any
                                                        </option>
                                                        <option value="before">
                                                            Before my shift
                                                        </option>
                                                        <option value="after">
                                                            After my shift
                                                        </option>
                                                    </select>
                                                </div>
                                            )}
                                            {haveShiftOnDate === false && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs">
                                                        When you&apos;re
                                                        available to follow
                                                        (choose all that apply)
                                                    </Label>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        e.g. after an AM shift,
                                                        or before a PM shift
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                                                                Before
                                                            </p>
                                                            {[
                                                                'before_am',
                                                                'before_pm',
                                                                'before_mid',
                                                            ].map((slot) => (
                                                                <label
                                                                    key={slot}
                                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={willingToFollowSlots.includes(
                                                                            slot,
                                                                        )}
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setWillingToFollowSlots(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    e
                                                                                        .target
                                                                                        .checked
                                                                                        ? [
                                                                                              ...prev,
                                                                                              slot,
                                                                                          ]
                                                                                        : prev.filter(
                                                                                              (
                                                                                                  s,
                                                                                              ) =>
                                                                                                  s !==
                                                                                                  slot,
                                                                                          ),
                                                                            )
                                                                        }
                                                                        className="size-3.5 rounded border border-input"
                                                                    />
                                                                    {slot.includes(
                                                                        '_am',
                                                                    )
                                                                        ? 'AM'
                                                                        : slot.includes(
                                                                                '_pm',
                                                                            )
                                                                          ? 'PM'
                                                                          : 'Mid'}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                                                                After
                                                            </p>
                                                            {[
                                                                'after_am',
                                                                'after_pm',
                                                                'after_mid',
                                                            ].map((slot) => (
                                                                <label
                                                                    key={slot}
                                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={willingToFollowSlots.includes(
                                                                            slot,
                                                                        )}
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setWillingToFollowSlots(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    e
                                                                                        .target
                                                                                        .checked
                                                                                        ? [
                                                                                              ...prev,
                                                                                              slot,
                                                                                          ]
                                                                                        : prev.filter(
                                                                                              (
                                                                                                  s,
                                                                                              ) =>
                                                                                                  s !==
                                                                                                  slot,
                                                                                          ),
                                                                            )
                                                                        }
                                                                        className="size-3.5 rounded border border-input"
                                                                    />
                                                                    {slot.includes(
                                                                        '_am',
                                                                    )
                                                                        ? 'AM'
                                                                        : slot.includes(
                                                                                '_pm',
                                                                            )
                                                                          ? 'PM'
                                                                          : 'Mid'}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2">
                                                        <Label className="text-xs">
                                                            Other (describe)
                                                        </Label>
                                                        <Input
                                                            value={
                                                                willingToFollowCustom
                                                            }
                                                            onChange={(e) =>
                                                                setWillingToFollowCustom(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="e.g. flexible 06–14"
                                                            className="mt-0.5 h-8 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={goReview}>
                                Continue to review
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
