import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BidderIdentityFields({
    idPrefix,
    displayName,
    seniorityRank,
    vacationBank,
    skipsBid = false,
    onDisplayNameChange,
    onSeniorityRankChange,
    onVacationBankChange,
    onSkipsBidChange,
    displayNameError,
    seniorityRankError,
}: {
    idPrefix: string;
    displayName: string;
    seniorityRank: number;
    vacationBank: number;
    skipsBid?: boolean;
    onDisplayNameChange: (value: string) => void;
    onSeniorityRankChange: (value: number) => void;
    onVacationBankChange: (value: number) => void;
    onSkipsBidChange?: (value: boolean) => void;
    displayNameError?: string;
    seniorityRankError?: string;
}) {
    return (
        <div className="space-y-4 rounded-lg border border-sidebar-border/60 bg-muted/10 p-3">
            <p className="text-xs text-muted-foreground">
                Set name, seniority, and vacation bank for this bidder. These
                usually change for each person even when reusing a saved profile.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-display-name`}>Name</Label>
                    <Input
                        id={`${idPrefix}-display-name`}
                        value={displayName}
                        onChange={(e) => onDisplayNameChange(e.target.value)}
                        placeholder="e.g. Jane Smith"
                    />
                    {displayNameError && (
                        <p className="text-sm text-destructive">
                            {displayNameError}
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-seniority-rank`}>
                        Seniority rank
                    </Label>
                    <Input
                        id={`${idPrefix}-seniority-rank`}
                        type="number"
                        min={1}
                        value={seniorityRank}
                        onChange={(e) =>
                            onSeniorityRankChange(Number(e.target.value))
                        }
                    />
                    <p className="text-xs text-muted-foreground">
                        Pick order and minimum lines to rank on bid sheet
                    </p>
                    {seniorityRankError && (
                        <p className="text-sm text-destructive">
                            {seniorityRankError}
                        </p>
                    )}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-vacation-bank`}>
                    Vacation bank
                </Label>
                <Input
                    id={`${idPrefix}-vacation-bank`}
                    type="number"
                    min={0}
                    max={255}
                    className="h-8 max-w-[8rem] text-sm"
                    value={vacationBank}
                    onChange={(e) =>
                        onVacationBankChange(
                            Math.max(0, Number(e.target.value) || 0),
                        )
                    }
                />
            </div>
            {onSkipsBidChange && (
                <div className="flex items-start gap-2">
                    <Checkbox
                        id={`${idPrefix}-skips-bid`}
                        checked={skipsBid}
                        onCheckedChange={(checked) =>
                            onSkipsBidChange(checked === true)
                        }
                    />
                    <div className="space-y-1">
                        <Label
                            htmlFor={`${idPrefix}-skips-bid`}
                            className="cursor-pointer font-normal"
                        >
                            Passes / does not bid
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            This person keeps their seniority slot but will not
                            pick a line when the simulation runs.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
