export type Priority = 'ignore' | 'low' | 'high';

export type TieredRankEntry = {
    key: string;
    priority: Priority;
    tier?: number;
};

export function normalizeTierOrder(
    entries: TieredRankEntry[],
): TieredRankEntry[] {
    if (entries.length === 0) {
        return [];
    }

    const rawTiers = entries.map((entry, index) => entry.tier ?? index + 1);
    const unique = [...new Set(rawTiers)].sort((a, b) => a - b);
    const tierMap = new Map(unique.map((raw, index) => [raw, index + 1]));

    return entries.map((entry, index) => ({
        ...entry,
        tier: tierMap.get(entry.tier ?? index + 1)!,
    }));
}

export function entriesToTierGroups(
    entries: TieredRankEntry[],
): TieredRankEntry[][] {
    const normalized = normalizeTierOrder(entries);
    const groups: TieredRankEntry[][] = [];

    for (const entry of normalized) {
        const last = groups[groups.length - 1];
        if (last && last[0]?.tier === entry.tier) {
            last.push(entry);
        } else {
            groups.push([entry]);
        }
    }

    return groups;
}

export function tierGroupsToEntries(
    groups: TieredRankEntry[][],
): TieredRankEntry[] {
    const out: TieredRankEntry[] = [];

    groups.forEach((group, groupIndex) => {
        const tier = groupIndex + 1;
        group.forEach((entry) => out.push({ ...entry, tier }));
    });

    return out;
}

/** Renumber tiers 1..N from consecutive groups in list order (matches editor G1, G2…). */
export function syncTiersFromVisualGroups(
    entries: TieredRankEntry[],
): TieredRankEntry[] {
    return tierGroupsToEntries(entriesToTierGroups(entries));
}

function mergeNonContiguousTierBlocks(
    entries: TieredRankEntry[],
): TieredRankEntry[] {
    if (entries.length === 0) {
        return [];
    }

    let work = normalizeTierOrder(entries);
    const indicesByTier = new Map<number, number[]>();

    work.forEach((entry, index) => {
        const tier = entry.tier ?? 1;
        const list = indicesByTier.get(tier) ?? [];
        list.push(index);
        indicesByTier.set(tier, list);
    });

    for (const [tier, indices] of indicesByTier) {
        if (indices.length <= 1) {
            continue;
        }

        let firstRunEnd = indices[0];
        for (let offset = 1; offset < indices.length; offset++) {
            if (indices[offset] === firstRunEnd + 1) {
                firstRunEnd = indices[offset];
            } else {
                break;
            }
        }

        const orphanKeys = indices
            .filter((index) => index > firstRunEnd)
            .map((index) => work[index]?.key)
            .filter((key): key is string => Boolean(key));

        if (orphanKeys.length === 0) {
            continue;
        }

        const orphans: TieredRankEntry[] = [];
        const without: TieredRankEntry[] = [];
        for (const entry of work) {
            if ((entry.tier ?? 1) === tier && orphanKeys.includes(entry.key)) {
                orphans.push(entry);
            } else {
                without.push(entry);
            }
        }

        const anchorKey = work[firstRunEnd]?.key;
        let insertAt = without.length;
        const anchorIndex = without.findIndex((entry) => entry.key === anchorKey);
        if (anchorIndex >= 0) {
            insertAt = anchorIndex + 1;
        }

        without.splice(insertAt, 0, ...orphans);
        work = without;
    }

    return work;
}

/** Group orphaned same-tier rows, then renumber visual groups G1, G2… */
export function prepareDeskRankEntries(
    entries: TieredRankEntry[],
): TieredRankEntry[] {
    if (entries.length === 0) {
        return [];
    }

    return syncTiersFromVisualGroups(mergeNonContiguousTierBlocks(entries));
}

export function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);

    return next;
}

export function groupWithAbove(
    entries: TieredRankEntry[],
    index: number,
): TieredRankEntry[] {
    if (index <= 0) {
        return entries;
    }

    const next = [...entries];
    const prevTier = next[index - 1].tier ?? index;
    next[index] = { ...next[index], tier: prevTier };

    return normalizeTierOrder(next);
}

export function joinEntryWithTarget(
    entries: TieredRankEntry[],
    fromIndex: number,
    targetIndex: number,
): TieredRankEntry[] {
    if (
        fromIndex === targetIndex ||
        fromIndex < 0 ||
        targetIndex < 0 ||
        fromIndex >= entries.length ||
        targetIndex >= entries.length
    ) {
        return entries;
    }

    const targetTier = entries[targetIndex].tier ?? targetIndex + 1;
    const item = entries[fromIndex];
    const without = entries.filter((_, entryIndex) => entryIndex !== fromIndex);
    const adjustedTarget =
        fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const merged = [...without];
    merged.splice(adjustedTarget + 1, 0, { ...item, tier: targetTier });

    return normalizeTierOrder(merged);
}

export function createNewGroupForEntry(
    entries: TieredRankEntry[],
    index: number,
): TieredRankEntry[] {
    const maxTier = Math.max(
        ...entries.map((entry, entryIndex) => entry.tier ?? entryIndex + 1),
    );
    const item = { ...entries[index], tier: maxTier + 1 };
    const without = entries.filter((_, entryIndex) => entryIndex !== index);

    return normalizeTierOrder([...without, item]);
}

export function assignEntryToGroup(
    entries: TieredRankEntry[],
    index: number,
    groupNumber: number,
): TieredRankEntry[] {
    if (index < 0 || index >= entries.length || groupNumber < 1) {
        return entries;
    }

    const groups = entriesToTierGroups(entries);
    const targetGroup = groups[groupNumber - 1];
    if (!targetGroup) {
        return createNewGroupForEntry(entries, index);
    }

    const lastMemberKey = targetGroup[targetGroup.length - 1]?.key;
    const anchorIndex = entries.findIndex((entry) => entry.key === lastMemberKey);
    if (anchorIndex < 0) {
        return entries;
    }

    if (anchorIndex === index) {
        return entries;
    }

    return joinEntryWithTarget(entries, index, anchorIndex);
}

export function splitAfter(
    entries: TieredRankEntry[],
    index: number,
): TieredRankEntry[] {
    if (index >= entries.length - 1) {
        return entries;
    }

    const next = [...entries];
    const followTier = next[index + 1].tier ?? index + 2;

    next[index + 1] = {
        ...next[index + 1],
        tier: followTier + 10_000,
    };

    for (let i = index + 2; i < next.length; i++) {
        const tier = next[i].tier ?? i + 1;
        if (tier === followTier) {
            next[i] = { ...next[i], tier: tier + 10_000 };
        } else {
            break;
        }
    }

    return normalizeTierOrder(next);
}

/** @deprecated Use splitAfter */
export function startNewGroupBelow(
    entries: TieredRankEntry[],
    index: number,
): TieredRankEntry[] {
    return splitAfter(entries, index);
}
