import { Equal, GripVertical, Trash2, Ungroup } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CompactPrioritySelect,
    DraggablePreferenceRow,
    MobileReorderButtons,
    preferencePuckGroupClass,
    preferencePuckLabelClass,
} from '@/pages/app/bid-tools/preference-rank-shared';
import {
    assignEntryToGroup,
    createNewGroupForEntry,
    entriesToTierGroups,
    groupWithAbove,
    moveIndex,
    splitAfter,
} from '@/pages/app/bid-tools/rank-tier-utils';
import type {
    Priority,
    TieredRankEntry,
} from '@/pages/app/bid-tools/rank-tier-utils';

function PrioritySelect({
    value,
    onChange,
    compact = false,
}: {
    value: Priority;
    onChange: (p: Priority) => void;
    compact?: boolean;
}) {
    if (compact) {
        return <CompactPrioritySelect value={value} onChange={onChange} />;
    }

    return (
        <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
            <SelectTrigger className="h-8 w-[7.5rem] text-xs">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="ignore">Don&apos;t care</SelectItem>
            </SelectContent>
        </Select>
    );
}

function DraggableRow({
    index,
    listLength,
    onReorder,
    children,
}: {
    index: number;
    listLength: number;
    onReorder: (from: number, to: number) => void;
    children: ReactNode;
}) {
    const [over, setOver] = useState(false);

    return (
        <div
            className={`flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 ${over ? 'border-primary/40 bg-muted/40' : ''}`}
            onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const raw = e.dataTransfer.getData('text/plain');
                const from = Number.parseInt(raw, 10);
                if (!Number.isNaN(from)) {
                    onReorder(from, index);
                }
            }}
        >
            <button
                type="button"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                className="hidden cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:inline-flex"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <MobileReorderButtons
                index={index}
                listLength={listLength}
                onReorder={onReorder}
            />
            {children}
        </div>
    );
}

function CompactGroupSelect({
    value,
    groupCount,
    onChange,
}: {
    value: number;
    groupCount: number;
    onChange: (groupNumber: number | 'new') => void;
}) {
    return (
        <Select
            value={String(value)}
            onValueChange={(next) =>
                onChange(next === 'new' ? 'new' : Number(next))
            }
        >
            <SelectTrigger
                className="h-7 w-[3.5rem] shrink-0 px-1.5 text-[11px]"
                title="Preference group"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {Array.from({ length: groupCount }, (_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                        G{index + 1}
                    </SelectItem>
                ))}
                <SelectItem value="new">New group</SelectItem>
            </SelectContent>
        </Select>
    );
}

export function TieredRankList({
    idPrefix,
    label,
    hint,
    entries,
    labels,
    onChange,
    onRemoveKey,
    compact = false,
    hideLabel = false,
    hidePriority = false,
}: {
    idPrefix: string;
    label: string;
    hint?: string;
    entries: TieredRankEntry[];
    labels: Record<string, string>;
    onChange: (entries: TieredRankEntry[]) => void;
    onRemoveKey?: (key: string) => void;
    compact?: boolean;
    hideLabel?: boolean;
    hidePriority?: boolean;
}) {
    const flatIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        entries.forEach((entry, index) => map.set(entry.key, index));

        return map;
    }, [entries]);

    const groups = useMemo(() => entriesToTierGroups(entries), [entries]);

    const updateEntry = (index: number, patch: Partial<TieredRankEntry>) => {
        const next = [...entries];
        next[index] = { ...next[index], ...patch };
        onChange(next);
    };

    const reorderFlat = (from: number, to: number) => {
        onChange(moveIndex(entries, from, to));
    };

    const mergeWithAbove = (index: number) => {
        onChange(groupWithAbove(entries, index));
    };

    const splitBelow = (index: number) => {
        onChange(splitAfter(entries, index));
    };

    const assignGroup = (index: number, groupNumber: number | 'new') => {
        onChange(
            groupNumber === 'new'
                ? createNewGroupForEntry(entries, index)
                : assignEntryToGroup(entries, index, groupNumber),
        );
    };

    const canJoinAbove = (index: number) =>
        index > 0 &&
        (entries[index].tier ?? index + 1) !==
            (entries[index - 1].tier ?? index);

    const Row = compact ? DraggablePreferenceRow : DraggableRow;

    return (
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {!hideLabel && (
                <Label className={compact ? 'text-xs' : undefined}>{label}</Label>
            )}
            {hint && !compact && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            {!compact && (
                <p className="text-xs text-muted-foreground">
                    Drag to reorder. Pick G1/G2… to tie items as equal, or use
                    Join ↑ / Split after to adjust groups.
                </p>
            )}
            {compact && (
                <p className="text-[11px] text-muted-foreground">
                    Pick G1/G2… to tie items together. Join ↑ merges with the
                    group above; split starts a new group below.
                </p>
            )}
            <div className={compact ? 'flex flex-col gap-1.5' : 'space-y-2'}>
                {groups.map((group, groupIndex) => (
                    <div
                        key={`${idPrefix}-tier-${groupIndex}`}
                        className={
                            compact
                                ? preferencePuckGroupClass
                                : 'space-y-1 rounded-lg border border-sidebar-border/60 bg-muted/10 p-2'
                        }
                    >
                        <p
                            className={
                                compact
                                    ? 'text-[10px] font-medium tracking-wide text-muted-foreground uppercase'
                                    : 'px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase'
                            }
                        >
                            G{groupIndex + 1}
                            {groupIndex === 0 ? ' ↑' : ''}
                        </p>
                        {group.map((entry) => {
                            const flatIndex =
                                flatIndexByKey.get(entry.key) ?? 0;
                            const currentGroupNumber = groupIndex + 1;

                            return (
                                <Row
                                    key={`${idPrefix}-${entry.key}`}
                                    index={flatIndex}
                                    listLength={entries.length}
                                    onReorder={reorderFlat}
                                >
                                    <span className={compact ? preferencePuckLabelClass : 'min-w-0 flex-1 text-sm'}>
                                        {labels[entry.key] ?? entry.key}
                                    </span>
                                    {!hidePriority && (
                                        <PrioritySelect
                                            value={entry.priority}
                                            compact={compact}
                                            onChange={(priority) =>
                                                updateEntry(flatIndex, {
                                                    priority,
                                                })
                                            }
                                        />
                                    )}
                                    <CompactGroupSelect
                                        value={currentGroupNumber}
                                        groupCount={groups.length}
                                        onChange={(groupNumber) =>
                                            assignGroup(flatIndex, groupNumber)
                                        }
                                    />
                                    {canJoinAbove(flatIndex) && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className={
                                                compact
                                                    ? 'h-7 shrink-0 px-1.5 text-[10px] text-muted-foreground'
                                                    : 'h-8 px-2 text-xs'
                                            }
                                            title="Join the preference group above"
                                            onClick={() =>
                                                mergeWithAbove(flatIndex)
                                            }
                                        >
                                            {compact ? (
                                                'Join ↑'
                                            ) : (
                                                <>
                                                    <Equal className="mr-1 h-3.5 w-3.5" />
                                                    Join ↑
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    {flatIndex < entries.length - 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size={compact ? 'icon' : 'sm'}
                                            className={
                                                compact
                                                    ? 'h-7 w-7 shrink-0 text-muted-foreground'
                                                    : 'h-8 px-2 text-xs'
                                            }
                                            title="Start a new preference group after this row"
                                            onClick={() =>
                                                splitBelow(flatIndex)
                                            }
                                        >
                                            {compact ? (
                                                <Ungroup className="h-3.5 w-3.5" />
                                            ) : (
                                                <>
                                                    <Ungroup className="mr-1 h-3.5 w-3.5" />
                                                    Split after
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    {onRemoveKey && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground"
                                            title="Remove from list"
                                            onClick={() =>
                                                onRemoveKey(entry.key)
                                            }
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </Row>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
