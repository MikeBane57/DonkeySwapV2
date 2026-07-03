import {
    keyHolidayContextLines,
    keyHolidayLabel
    
} from '@/pages/app/bid-tools/holiday-metrics';
import type {KeyHolidayGroup} from '@/pages/app/bid-tools/holiday-metrics';

export function KeyHolidayCell({
    group,
}: {
    group: KeyHolidayGroup | undefined;
}) {
    const label = keyHolidayLabel(group);
    const contextLines = keyHolidayContextLines(group);

    if (label === '—' && contextLines.length === 0) {
        return <>—</>;
    }

    return (
        <div>
            <div>{label}</div>
            {contextLines.map((line) => (
                <div
                    key={line}
                    className="text-[11px] leading-snug text-muted-foreground"
                    title={line}
                >
                    {line}
                </div>
            ))}
        </div>
    );
}
