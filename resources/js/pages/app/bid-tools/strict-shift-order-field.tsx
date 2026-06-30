import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function StrictShiftOrderField({
    id,
    checked,
    onCheckedChange,
    compact = false,
}: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    compact?: boolean;
}) {
    return (
        <div
            className={
                compact
                    ? 'space-y-1'
                    : 'space-y-2 rounded-lg border border-sidebar-border/60 bg-muted/10 p-3'
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
                        Rank all AM lines before PM, then Mid, then Relief.
                        Other preferences only apply within the same shift
                        bucket.
                    </p>
                    {!compact && (
                        <p className="text-xs text-muted-foreground">
                            Shift buckets use clock start (06/07 = AM, 14/15 =
                            PM, 22 = Mid). Relief lines always sort last in
                            their group regardless of start time.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function normalizeStrictShiftOrder(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
}
