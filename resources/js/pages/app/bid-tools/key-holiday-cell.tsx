import {
    keyHolidayContextLabel,
    keyHolidayLabel,
    type KeyHolidayGroup,
} from '@/pages/app/bid-tools/holiday-metrics';

export function KeyHolidayCell({
    group,
}: {
    group: KeyHolidayGroup | undefined;
}) {
    const label = keyHolidayLabel(group);
    const context = keyHolidayContextLabel(group);

    if (label === '—' && !context) {
        return <>—</>;
    }

    return (
        <div>
            <div>{label}</div>
            {context && (
                <div
                    className="text-[11px] leading-snug text-muted-foreground"
                    title={context}
                >
                    {context}
                </div>
            )}
        </div>
    );
}
