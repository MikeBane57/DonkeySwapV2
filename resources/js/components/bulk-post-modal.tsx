import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Handshake, Gift, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

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
        const postings: { type: string; cash_amount?: number; notes?: string }[] = [];
        if (postAsTrade) {
            postings.push({
                type: 'trade',
                cash_amount: tradeCash ? parseFloat(tradeCash) : undefined,
                notes: notes || undefined,
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
                setSubmitError(data.message ?? data.errors?.postings?.[0] ?? `Request failed (${res.status}). Try again.`);
            }
        } catch (err) {
            setSubmitError('Network error. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>Post {shiftIds.length} shift{shiftIds.length !== 1 ? 's' : ''} in bulk</DialogTitle>
                </DialogHeader>
                {shiftCountLabel && (
                    <p className="text-sm text-muted-foreground">{shiftCountLabel}</p>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2">
                        <div className="space-y-3">
                            <Label>Posting type (choose one or both)</Label>
                            <label
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                    postAsTrade ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={postAsTrade}
                                    onChange={(e) => setPostAsTrade(e.target.checked)}
                                    className="mt-1 size-4 shrink-0 rounded border border-input"
                                    aria-label="Post as trade"
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2 font-medium">
                                        <Handshake className="h-4 w-4 shrink-0 text-blue-600" />
                                        Trade
                                    </span>
                                    {postAsTrade && (
                                        <div className="mt-2">
                                            <Label className="text-xs">Cash (optional)</Label>
                                            <div className="relative mt-0.5">
                                                <DollarSign className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={tradeCash}
                                                    onChange={(e) => setTradeCash(e.target.value)}
                                                    placeholder="0"
                                                    className="h-8 pl-8"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </label>
                            <label
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                                    postAsGiveaway ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={postAsGiveaway}
                                    onChange={(e) => setPostAsGiveaway(e.target.checked)}
                                    className="mt-1 size-4 shrink-0 rounded border border-input"
                                    aria-label="Post as giveaway"
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2 font-medium">
                                        <Gift className="h-4 w-4 shrink-0 text-green-600" />
                                        Giveaway
                                    </span>
                                    {postAsGiveaway && (
                                        <div className="mt-2">
                                            <Label className="text-xs">Amount</Label>
                                            <div className="relative mt-0.5">
                                                <DollarSign className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={cashAmount}
                                                    onChange={(e) => setCashAmount(e.target.value)}
                                                    className="h-8 pl-8"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                        {submitError && (
                            <p className="text-sm text-destructive">{submitError}</p>
                        )}
                        <div>
                            <Label className="text-xs">Notes (optional, same for all)</Label>
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
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Posting…' : `Post ${shiftIds.length} shift${shiftIds.length !== 1 ? 's' : ''}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
