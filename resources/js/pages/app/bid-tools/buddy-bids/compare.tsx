import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Balance = {
    doubles_delta: number;
    singles_adjusted_delta: number;
    unassigned_overlaps: number;
};

type SummaryRow = {
    participant_id: number;
    display_name: string;
    doubles: number;
    singles: number;
    buddy_offs: number;
    vacation_on_work: number;
    pulls_on_work: number;
    training_on_work: number;
    line_offs: number;
    overlap_pending: number;
};

type SnapshotOption = {
    id: number;
    name: string;
    created_at: string;
    balance: Balance;
};

type Version = {
    key: string;
    id: number | null;
    name: string;
    created_at: string | null;
    summary: SummaryRow[];
    balance: Balance;
};

type PairwiseDiff = {
    version_a: string;
    version_b: string;
    count: number;
    dates: string[];
};

function shortName(name: string, max = 18): string {
    return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function CompareSetup({
    planId,
    snapshots,
    prefill,
}: {
    planId: number;
    snapshots: SnapshotOption[];
    prefill: {
        snapshot_ids: number[];
        include_current: boolean;
    };
}) {
    const [includeCurrent, setIncludeCurrent] = useState(
        prefill.include_current,
    );
    const [selectedSnapshots, setSelectedSnapshots] = useState<
        Record<number, boolean>
    >(() => {
        const next: Record<number, boolean> = {};
        prefill.snapshot_ids.forEach((id) => {
            next[id] = true;
        });
        return next;
    });

    const selectedCount =
        Object.values(selectedSnapshots).filter(Boolean).length +
        (includeCurrent ? 1 : 0);

    const runCompare = () => {
        const snapshotIds = Object.entries(selectedSnapshots)
            .filter(([, checked]) => checked)
            .map(([id]) => Number(id));

        router.post(`/app/bid-tools/buddy-bids/${planId}/compare`, {
            include_current: includeCurrent,
            snapshot_ids: snapshotIds,
        });
    };

    return (
        <div className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
            <h2 className="text-sm font-medium">Choose versions</h2>
            <p className="text-xs text-muted-foreground">
                Pick at least two versions — current plan plus saved snapshots —
                to compare overlap totals side by side.
            </p>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="include-current"
                        checked={includeCurrent}
                        onCheckedChange={(checked) =>
                            setIncludeCurrent(checked === true)
                        }
                    />
                    <Label htmlFor="include-current">Current plan</Label>
                </div>

                {snapshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No saved snapshots yet. Save versions from the plan page
                        first.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {snapshots.map((snapshot) => (
                            <div
                                key={snapshot.id}
                                className="flex items-start gap-2 rounded-md border border-sidebar-border/50 p-3"
                            >
                                <Checkbox
                                    id={`snapshot-${snapshot.id}`}
                                    checked={
                                        selectedSnapshots[snapshot.id] ?? false
                                    }
                                    onCheckedChange={(checked) =>
                                        setSelectedSnapshots((current) => ({
                                            ...current,
                                            [snapshot.id]: checked === true,
                                        }))
                                    }
                                />
                                <div className="space-y-1">
                                    <Label
                                        htmlFor={`snapshot-${snapshot.id}`}
                                        className="font-medium"
                                    >
                                        {snapshot.name}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Saved{' '}
                                        {new Date(
                                            snapshot.created_at,
                                        ).toLocaleString()}
                                        · doubles Δ{' '}
                                        {snapshot.balance.doubles_delta}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Button
                type="button"
                disabled={selectedCount < 2}
                onClick={runCompare}
            >
                Compare selected
            </Button>
        </div>
    );
}

function CompareResults({
    versions,
    pairwiseDiffs,
}: {
    versions: Version[];
    pairwiseDiffs: PairwiseDiff[];
}) {
    const versionLabel = (key: string) =>
        versions.find((version) => version.key === key)?.name ?? key;

    return (
        <div className="space-y-6">
            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                <table className="w-full min-w-[48rem] text-left text-xs">
                    <thead>
                        <tr className="border-b bg-muted/20 text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Metric</th>
                            {versions.map((version) => (
                                <th
                                    key={version.key}
                                    className="px-3 py-2 font-medium"
                                >
                                    {shortName(version.name)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-sidebar-border/40">
                            <td className="px-3 py-2">Doubles delta</td>
                            {versions.map((version) => (
                                <td
                                    key={version.key}
                                    className="px-3 py-2 font-mono"
                                >
                                    {version.balance.doubles_delta}
                                </td>
                            ))}
                        </tr>
                        <tr className="border-b border-sidebar-border/40">
                            <td className="px-3 py-2">
                                Singles + time off delta
                            </td>
                            {versions.map((version) => (
                                <td
                                    key={version.key}
                                    className="px-3 py-2 font-mono"
                                >
                                    {version.balance.singles_adjusted_delta}
                                </td>
                            ))}
                        </tr>
                        <tr className="border-b border-sidebar-border/40">
                            <td className="px-3 py-2">Unassigned overlaps</td>
                            {versions.map((version) => (
                                <td
                                    key={version.key}
                                    className="px-3 py-2 font-mono"
                                >
                                    {version.balance.unassigned_overlaps}
                                </td>
                            ))}
                        </tr>
                        {versions[0]?.summary.map((_, index) => (
                            <tr
                                key={`buddy-${index}`}
                                className="border-b border-sidebar-border/40"
                            >
                                <td className="px-3 py-2">
                                    {versions[0].summary[index]?.display_name}{' '}
                                    doubles
                                </td>
                                {versions.map((version) => (
                                    <td
                                        key={version.key}
                                        className="px-3 py-2 font-mono"
                                    >
                                        {version.summary[index]?.doubles ?? '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pairwiseDiffs.length > 0 && (
                <div className="space-y-3 rounded-lg border border-sidebar-border/70 p-4">
                    <h3 className="text-sm font-medium">
                        Overlap assignment differences
                    </h3>
                    <div className="space-y-2 text-xs">
                        {pairwiseDiffs.map((diff) => (
                            <div
                                key={`${diff.version_a}-${diff.version_b}`}
                                className="rounded-md border border-sidebar-border/50 bg-muted/10 p-3"
                            >
                                <p className="font-medium">
                                    {shortName(versionLabel(diff.version_a))} vs{' '}
                                    {shortName(versionLabel(diff.version_b))}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    {diff.count} overlap day
                                    {diff.count === 1 ? '' : 's'} differ
                                    {diff.count > 0 &&
                                        ` (first: ${diff.dates
                                            .slice(0, 3)
                                            .join(', ')}${
                                            diff.dates.length > 3 ? '…' : ''
                                        })`}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BuddyBidsCompare({
    plan,
    snapshots,
    comparison,
    prefill,
}: {
    plan: {
        id: number;
        name: string;
        bid_year: number;
    };
    snapshots: SnapshotOption[];
    comparison: {
        include_current: boolean;
        versions: Version[];
        pairwise_diffs: PairwiseDiff[];
    } | null;
    prefill: {
        snapshot_ids: number[];
        include_current: boolean;
    };
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Buddy bids', href: '/app/bid-tools/buddy-bids' },
        { title: plan.name, href: `/app/bid-tools/buddy-bids/${plan.id}` },
        { title: 'Compare versions', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Compare · ${plan.name}`} />
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Compare versions
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {plan.name} · bid {plan.bid_year}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/app/bid-tools/buddy-bids/${plan.id}`}>
                            Back to plan
                        </Link>
                    </Button>
                </div>

                <CompareSetup
                    planId={plan.id}
                    snapshots={snapshots}
                    prefill={prefill}
                />

                {comparison && comparison.versions.length >= 2 && (
                    <CompareResults
                        versions={comparison.versions}
                        pairwiseDiffs={comparison.pairwise_diffs}
                    />
                )}
            </div>
        </AppLayout>
    );
}
