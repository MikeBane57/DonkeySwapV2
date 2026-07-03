import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

export function LineDeskGroupEditor({
    lineId,
    value,
    options,
}: {
    lineId: number;
    value: string;
    options: string[];
}) {
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const datalistId = `desk-groups-${lineId}`;

    useEffect(() => {
        setDraft(value);
    }, [value]);

    const save = (nextValue: string): void => {
        const trimmed = nextValue.trim();
        if (trimmed === '' || trimmed === value) {
            setDraft(value);
            return;
        }

        setSaving(true);
        router.patch(
            `/app/bid-tools/lines/${lineId}/desk-group`,
            { desk_group: trimmed },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onError: () => setDraft(value),
            },
        );
    };

    return (
        <div className="min-w-[5.5rem]">
            <Input
                list={datalistId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => save(draft)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                        setDraft(value);
                        event.currentTarget.blur();
                    }
                }}
                className="h-8 px-2 font-mono text-xs"
                disabled={saving}
                aria-label="Desk group"
            />
            <datalist id={datalistId}>
                {options.map((option) => (
                    <option key={option} value={option} />
                ))}
            </datalist>
        </div>
    );
}
