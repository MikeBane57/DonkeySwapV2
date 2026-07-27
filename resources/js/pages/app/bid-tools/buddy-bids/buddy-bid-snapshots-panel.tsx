import { Link, router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SnapshotRow = {
    id: number;
    name: string;
    created_at: string;
    balance: {
        doubles_delta: number;
        singles_adjusted_delta: number;
        unassigned_overlaps: number;
    };
};

export function BuddyBidSnapshotsPanel({
    planId,
    snapshots,
    hasUnsavedChanges,
    onSaveBeforeSnapshot,
}: {
    planId: number;
    snapshots: SnapshotRow[];
    hasUnsavedChanges: boolean;
    onSaveBeforeSnapshot?: () => Promise<void>;
}) {
    const snapshotForm = useForm({
        name: '',
    });

    const saveSnapshot = async (event: React.FormEvent) => {
        event.preventDefault();

        if (hasUnsavedChanges && onSaveBeforeSnapshot) {
            await onSaveBeforeSnapshot();
        }

        snapshotForm.post(`/app/bid-tools/buddy-bids/${planId}/snapshots`, {
            preserveScroll: true,
            onSuccess: () => snapshotForm.setData('name', ''),
        });
    };

    const restoreSnapshot = (snapshotId: number, snapshotName: string) => {
        if (
            !window.confirm(
                `Restore "${snapshotName}"? This replaces all overlap assignments on the live plan.`,
            )
        ) {
            return;
        }

        router.post(
            `/app/bid-tools/buddy-bids/${planId}/snapshots/${snapshotId}/restore`,
            {},
            { preserveScroll: true },
        );
    };

    const deleteSnapshot = (snapshotId: number, snapshotName: string) => {
        if (
            !window.confirm(
                `Delete snapshot "${snapshotName}"? This cannot be undone.`,
            )
        ) {
            return;
        }

        router.delete(
            `/app/bid-tools/buddy-bids/${planId}/snapshots/${snapshotId}`,
            { preserveScroll: true },
        );
    };

    return (
        <div className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-medium">Saved versions</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Save the current overlap plan to compare options later.
                        Snapshots capture saved overlap assignments and year
                        totals.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/bid-tools/buddy-bids/${planId}/compare`}>
                        Compare versions
                    </Link>
                </Button>
            </div>

            <form
                onSubmit={(event) => void saveSnapshot(event)}
                className="flex flex-wrap items-end gap-3"
            >
                <div className="min-w-[12rem] flex-1 space-y-2">
                    <Label htmlFor="snapshot-name">Snapshot name</Label>
                    <Input
                        id="snapshot-name"
                        value={snapshotForm.data.name}
                        onChange={(event) =>
                            snapshotForm.setData('name', event.target.value)
                        }
                        placeholder="e.g. 2/3 rotation option A"
                        maxLength={120}
                    />
                </div>
                <Button
                    type="submit"
                    disabled={
                        snapshotForm.processing ||
                        snapshotForm.data.name.trim() === ''
                    }
                >
                    Save snapshot
                </Button>
            </form>

            {hasUnsavedChanges && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                    Unsaved overlap changes will be saved before creating the
                    snapshot.
                </p>
            )}

            {snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No saved versions yet. Save a snapshot after you assign
                    overlaps or apply a rotation.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                        <thead>
                            <tr className="border-b text-muted-foreground">
                                <th className="pr-3 pb-2 font-medium">Name</th>
                                <th className="pr-3 pb-2 font-medium">Saved</th>
                                <th className="pr-3 pb-2 font-medium">
                                    Doubles Δ
                                </th>
                                <th className="pr-3 pb-2 font-medium">
                                    Singles Δ
                                </th>
                                <th className="pr-3 pb-2 font-medium">
                                    Unassigned
                                </th>
                                <th className="pb-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((snapshot) => (
                                <tr
                                    key={snapshot.id}
                                    className="border-b border-sidebar-border/40"
                                >
                                    <td className="py-2 pr-3 font-medium">
                                        {snapshot.name}
                                    </td>
                                    <td className="py-2 pr-3 text-muted-foreground">
                                        {new Date(
                                            snapshot.created_at,
                                        ).toLocaleString()}
                                    </td>
                                    <td className="py-2 pr-3 font-mono">
                                        {snapshot.balance.doubles_delta}
                                    </td>
                                    <td className="py-2 pr-3 font-mono">
                                        {
                                            snapshot.balance
                                                .singles_adjusted_delta
                                        }
                                    </td>
                                    <td className="py-2 pr-3 font-mono">
                                        {snapshot.balance.unassigned_overlaps}
                                    </td>
                                    <td className="py-2">
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    restoreSnapshot(
                                                        snapshot.id,
                                                        snapshot.name,
                                                    )
                                                }
                                            >
                                                Restore
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive"
                                                onClick={() =>
                                                    deleteSnapshot(
                                                        snapshot.id,
                                                        snapshot.name,
                                                    )
                                                }
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
