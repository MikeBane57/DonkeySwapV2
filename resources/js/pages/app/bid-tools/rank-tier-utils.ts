export type Priority = 'ignore' | 'low' | 'high';

export type TieredRankEntry = {
    key: string;
    priority: Priority;
    tier?: number;
};

export function normalizeTierOrder(entries: TieredRankEntry[]): TieredRankEntry[] {
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

export function entriesToTierGroups(entries: TieredRankEntry[]): TieredRankEntry[][] {
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

export function tierGroupsToEntries(groups: TieredRankEntry[][]): TieredRankEntry[] {
    const out: TieredRankEntry[] = [];

    groups.forEach((group, groupIndex) => {
        const tier = groupIndex + 1;
        group.forEach((entry) => out.push({ ...entry, tier }));
    });

    return out;
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
