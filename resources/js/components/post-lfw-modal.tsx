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
    onSuccess?: () => void;
};

export function PostLfwModal({
    open,
    onOpenChange,
    defaultDate,
    defaultWillingToFollow = false,
    defaultWillingToFollowTimeFrame = null,
    workgroups,
    onSuccess,
}: PostLfwModalProps) {
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
            setDate(defaultDate);
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

    const handleSubmit = async () => {
        setError(null);
        if (!date || !cash.trim() || Number(cash) < 0) {
            setError('Date and cash amount are required.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/looking-for-work/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    seeking_date: date,
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
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                onSuccess?.();
                onOpenChange(false);
            } else {
                setError(
                    data.message ||
                        (res.status === 422
                            ? 'Validation failed.'
                            : 'Failed to create post.'),
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Post &quot;Looking for work&quot;</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-3">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Full shift
                        </p>
                        <div>
                            <Label>Date you want to work</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="mt-1"
                                min={new Date().toISOString().slice(0, 10)}
                            />
                        </div>
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
                                                                  x !== dt.code,
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
                                placeholder="e.g. 500"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={obo}
                                onCheckedChange={(c) => setObo(!!c)}
                            />
                            Or best offer (OBO) — responders can offer more or
                            less
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
                                        You can cover part of a shift. Subject
                                        to 10-hour duty day and 8-hour rest
                                        before shift start.
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
                                                    When you&apos;re available
                                                    (up to 10 hours)
                                                </Label>
                                                <select
                                                    value={
                                                        willingToFollowTimeFrame ||
                                                        'any'
                                                    }
                                                    onChange={(e) =>
                                                        setWillingToFollowTimeFrame(
                                                            (e.target.value ||
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
                                                    When you&apos;re available
                                                    to follow (choose all that
                                                    apply)
                                                </Label>
                                                <p className="text-[11px] text-muted-foreground">
                                                    e.g. after an AM shift, or
                                                    before a PM shift
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
                                                                e.target.value,
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
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? '…' : 'Create'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
