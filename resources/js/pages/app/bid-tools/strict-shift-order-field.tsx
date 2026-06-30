import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    DraggablePreferenceRow,
    preferencePuckGroupClass,
    preferencePuckLabelClass,
} from '@/pages/app/bid-tools/preference-rank-shared';
import {
    STRICT_SHIFT_LABELS,
    
    normalizeStrictShiftRank
} from '@/pages/app/bid-tools/strict-shift-rank';
import type {StrictShiftClass} from '@/pages/app/bid-tools/strict-shift-rank';

function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);

    return next;
}

export function StrictShiftRankPicker({
    value,
    onChange,
    disabled = false,
}: {
    value: StrictShiftClass[];
    onChange: (order: StrictShiftClass[]) => void;
    disabled?: boolean;
}) {
    return (
        <div
            className={`space-y-1.5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
            <Label className="text-xs">Shift bucket order</Label>
            <p className="text-[11px] text-muted-foreground">
                Drag to set which shift bucket ranks first when strict shift
                order is on. Other lines always sort last.
            </p>
            <div
                className={`${preferencePuckGroupClass} flex-row flex-wrap gap-1.5`}
            >
                {value.map((shift, idx) => (
                    <DraggablePreferenceRow
                        key={shift}
                        index={idx}
                        onReorder={(from, to) =>
                            onChange(moveIndex(value, from, to))
                        }
                    >
                        <span
                            className={`${preferencePuckLabelClass} font-medium`}
                        >
                            {STRICT_SHIFT_LABELS[shift]}
                        </span>
                    </DraggablePreferenceRow>
                ))}
            </div>
        </div>
    );
}

export function StrictShiftOrderField({
    id,
    checked,
    onCheckedChange,
    rank,
    onRankChange,
    compact = false,
}: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    rank: StrictShiftClass[];
    onRankChange: (rank: StrictShiftClass[]) => void;
    compact?: boolean;
}) {
    return (
        <div
            className={
                compact
                    ? 'space-y-3'
                    : 'space-y-3 rounded-lg border border-sidebar-border/60 bg-muted/10 p-3'
            }
        >
            <div className="flex items-start gap-3">
                <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) => onCheckedChange(value === true)}
                    className="mt-0.5"
                />
                <div className="space-y-1">
                    <Label htmlFor={id} className="cursor-pointer text-sm">
                        Strict shift order
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Rank lines by shift bucket before other preferences.
                        Use the order below to choose which bucket bids first.
                    </p>
                    {!compact && (
                        <p className="text-xs text-muted-foreground">
                            Buckets use clock start (06/07 = AM, 14/15 = PM, 22
                            = Mid). Relief lines are classified separately.
                        </p>
                    )}
                </div>
            </div>
            <StrictShiftRankPicker
                value={rank}
                onChange={onRankChange}
                disabled={!checked}
            />
        </div>
    );
}

export function normalizeStrictShiftOrder(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
}

export { normalizeStrictShiftRank };
