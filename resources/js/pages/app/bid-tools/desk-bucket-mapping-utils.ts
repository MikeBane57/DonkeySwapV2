import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';

export type DeskBucketMapping = {
    desk_group: string;
    start_time: string | null;
    bucket: string;
};

export type DeskBucketReferenceRow = {
    desk_group: string;
    start_time: string;
    auto_bucket: string;
    desk_bucket: string;
    is_manual: boolean;
    line_count: number;
    sample_line_num: string;
};

export function deskMappingKey(deskGroup: string, startTime: string): string {
    return `${deskGroup}\0${startTime}`;
}

export function bucketForMappedLine(
    line: Pick<LinePickerRow, 'desk_group' | 'start_time' | 'desk_bucket' | 'auto_desk_bucket'>,
    mappings: DeskBucketMapping[],
    referenceByKey: Record<string, DeskBucketReferenceRow>,
): string {
    const startTime = line.start_time ?? '';
    const group = line.desk_group ?? '';
    const specific = mappings.find(
        (mapping) =>
            mapping.desk_group === group &&
            mapping.start_time !== null &&
            mapping.start_time !== '' &&
            mapping.start_time === startTime,
    );
    if (specific) {
        return specific.bucket;
    }

    const groupOnly = mappings.find(
        (mapping) =>
            mapping.desk_group === group &&
            (mapping.start_time === null || mapping.start_time === ''),
    );
    if (groupOnly) {
        return groupOnly.bucket;
    }

    return (
        referenceByKey[deskMappingKey(group, startTime)]?.auto_bucket ??
        line.auto_desk_bucket ??
        line.desk_bucket ??
        'unknown'
    );
}

export function updateDeskBucketMapping(
    mappings: DeskBucketMapping[],
    deskGroup: string,
    startTime: string,
    autoBucket: string,
    bucket: string,
): DeskBucketMapping[] {
    const withoutRow = mappings.filter(
        (mapping) =>
            !(
                mapping.desk_group === deskGroup &&
                (mapping.start_time ?? '') === startTime
            ),
    );

    if (bucket === autoBucket) {
        return withoutRow;
    }

    return [
        ...withoutRow,
        {
            desk_group: deskGroup,
            start_time: startTime || null,
            bucket,
        },
    ];
}

export function applyLineDeskBucketOverrides(
    lines: LinePickerRow[],
    deskBucketMappings: DeskBucketMapping[],
    referenceByKey: Record<string, DeskBucketReferenceRow>,
    lineDeskBuckets: Record<number, string>,
): LinePickerRow[] {
    const groupMapped = lines.map((line) => ({
        ...line,
        desk_bucket: bucketForMappedLine(line, deskBucketMappings, referenceByKey),
    }));

    return groupMapped.map((line) => ({
        ...line,
        desk_bucket: lineDeskBuckets[line.id] ?? line.desk_bucket,
    }));
}
