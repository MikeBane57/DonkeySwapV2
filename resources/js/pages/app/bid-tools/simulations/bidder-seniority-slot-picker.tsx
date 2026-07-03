import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type BidderSlot = {
    seniority_rank: number;
    display_name: string;
};

function slotLabel(
    rank: number,
    sortedBidders: BidderSlot[],
    mode: 'insert' | 'reposition',
): string {
    if (rank === 1) {
        return '#1 — picks first';
    }

    const previous = sortedBidders[rank - 2];

    if (mode === 'insert') {
        if (previous) {
            return `#${rank} — after ${previous.display_name}`;
        }

        return `#${rank} — last`;
    }

    if (previous) {
        return `#${rank} — after ${previous.display_name}`;
    }

    return `#${rank}`;
}

function shiftSummary(
    rank: number,
    sortedBidders: BidderSlot[],
    mode: 'insert' | 'reposition',
    currentRank?: number,
): string | null {
    if (mode === 'insert') {
        const affected = sortedBidders.filter(
            (bidder) => bidder.seniority_rank >= rank,
        );

        if (affected.length === 0) {
            return 'Adds at the end of the pick order.';
        }

        const names = affected.map((bidder) => bidder.display_name).join(', ');

        return `Moves ${names} down one spot.`;
    }

    if (currentRank === undefined || rank === currentRank) {
        return null;
    }

    if (rank < currentRank) {
        const affected = sortedBidders.filter(
            (bidder) =>
                bidder.seniority_rank >= rank &&
                bidder.seniority_rank < currentRank,
        );

        if (affected.length === 0) {
            return null;
        }

        return `Moves ${affected.map((bidder) => bidder.display_name).join(', ')} down one spot.`;
    }

    const affected = sortedBidders.filter(
        (bidder) =>
            bidder.seniority_rank > currentRank &&
            bidder.seniority_rank <= rank,
    );

    if (affected.length === 0) {
        return null;
    }

    return `Moves ${affected.map((bidder) => bidder.display_name).join(', ')} up one spot.`;
}

export function BidderSenioritySlotPicker({
    idPrefix,
    value,
    onChange,
    existingBidders,
    mode,
    currentRank,
    error,
}: {
    idPrefix: string;
    value: number;
    onChange: (rank: number) => void;
    existingBidders: BidderSlot[];
    mode: 'insert' | 'reposition';
    currentRank?: number;
    error?: string;
}) {
    const sortedBidders = [...existingBidders].sort(
        (a, b) => a.seniority_rank - b.seniority_rank,
    );
    const maxRank =
        mode === 'insert'
            ? sortedBidders.length + 1
            : Math.max(1, sortedBidders.length);
    const ranks = Array.from({ length: maxRank }, (_, index) => index + 1);
    const summary = shiftSummary(value, sortedBidders, mode, currentRank);

    return (
        <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-seniority-rank`}>Pick order</Label>
            <Select
                value={String(value)}
                onValueChange={(next) => onChange(Number(next))}
            >
                <SelectTrigger
                    id={`${idPrefix}-seniority-rank`}
                    className="h-9 max-w-md text-sm"
                >
                    <SelectValue placeholder="Choose pick order" />
                </SelectTrigger>
                <SelectContent>
                    {ranks.map((rank) => (
                        <SelectItem key={rank} value={String(rank)}>
                            {slotLabel(rank, sortedBidders, mode)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                {summary ??
                    'Pick order sets when this bidder chooses and the minimum lines they must rank.'}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
