import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { BidderProfile } from '@/pages/app/bid-tools/simulations/bidder-profile-fields';

export type ProfileTemplate = {
    id: number;
    name: string;
    profile: BidderProfile;
};

export type ProfileSource = 'new' | 'existing';

export function ProfileSourcePicker({
    idPrefix,
    source,
    onSourceChange,
    templates,
    selectedTemplateId,
    onTemplateSelect,
}: {
    idPrefix: string;
    source: ProfileSource;
    onSourceChange: (source: ProfileSource) => void;
    templates: ProfileTemplate[];
    selectedTemplateId: number | null;
    onTemplateSelect: (templateId: number) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label>Preference profile</Label>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                            source === 'new'
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-sidebar-border/60 text-muted-foreground hover:bg-muted/40'
                        }`}
                        onClick={() => onSourceChange('new')}
                    >
                        New profile
                    </button>
                    <button
                        type="button"
                        disabled={templates.length === 0}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            source === 'existing'
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-sidebar-border/60 text-muted-foreground hover:bg-muted/40'
                        }`}
                        onClick={() => onSourceChange('existing')}
                    >
                        From saved profile
                    </button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {source === 'new'
                        ? 'Start from defaults and customize holidays, desk tiers, and ranking.'
                        : 'Copy preferences from an existing scenario or another simulation bidder.'}
                </p>
            </div>

            {source === 'existing' && (
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-profile-template`}>
                        Saved profile
                    </Label>
                    {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No saved profiles for this import yet. Create a
                            scenario or add a bidder with a new profile first.
                        </p>
                    ) : (
                        <Select
                            value={
                                selectedTemplateId
                                    ? String(selectedTemplateId)
                                    : undefined
                            }
                            onValueChange={(value) =>
                                onTemplateSelect(Number(value))
                            }
                        >
                            <SelectTrigger
                                id={`${idPrefix}-profile-template`}
                                className="max-w-md"
                            >
                                <SelectValue placeholder="Choose a saved profile…" />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((template) => (
                                    <SelectItem
                                        key={template.id}
                                        value={String(template.id)}
                                    >
                                        {template.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}
        </div>
    );
}
