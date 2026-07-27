import { Head, router, useForm } from '@inertiajs/react';
import { BuddyBidCalendar } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-calendar';
import { BuddyBidRotationPanel } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-rotation-panel';
import { BuddyBidSnapshotsPanel } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-snapshots-panel';
import { BuddyBidSummaryPanel } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-summary-panel';
import { BUDDY_BID_AUTO_SAVE_MS } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import { DateListEditor } from '@/pages/app/bid-tools/buddy-bids/date-list-editor';
import { useDebouncedBuddyBidAssignments } from '@/pages/app/bid-tools/buddy-bids/use-debounced-buddy-bid-assignments';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';

type ParticipantProfile = {
    vacation_dates: string[];
    pull_dates: string[];
};

type CalendarPayload = {
    bid_year: number;
    lines_can_double: boolean;
    shift_pairing: string | null;
    participants: {
        id: number;
        slot: number;
        display_name: string;
        bid_line_id: number | null;
        line_num: string | null;
        desk_group: string | null;
        start_time: string | null;
        shift_bucket: string | null;
        profile: ParticipantProfile;
    }[];
    months: {
        key: string;
        label: string;
        days: {
            date: string;
            day_of_month: number;
            is_compatible_overlap: boolean;
            double_participant_id: number | null;
            participants: {
                participant_id: number;
                status: string;
                line_works: boolean;
                code: string | null;
            }[];
        }[];
    }[];
    summary: {
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
    }[];
    balance: {
        doubles_delta: number;
        singles_adjusted_delta: number;
        unassigned_overlaps: number;
    };
};

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

export default function BuddyBidsShow({
    plan,
    calendar,
    lines,
    snapshots,
}: {
    plan: {
        id: number;
        name: string;
        bid_year: number;
        bid_import_id: number;
    };
    calendar: CalendarPayload;
    lines: LinePickerRow[];
    snapshots: SnapshotRow[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Buddy bids', href: '/app/bid-tools/buddy-bids' },
        { title: plan.name, href: '#' },
    ];

    const participantForm = useForm({
        participants: calendar.participants.map((p) => ({
            id: p.id,
            display_name: p.display_name,
            bid_line_id: p.bid_line_id ?? 0,
            profile: {
                vacation_dates: p.profile.vacation_dates ?? [],
                pull_dates: p.profile.pull_dates ?? [],
            },
        })),
    });

    const {
        displayCalendar,
        assignments,
        assignOverlap,
        applyRotationAssignments,
        resetAssignments,
        saveNow,
        hasUnsavedChanges,
        saveState,
        saveError,
        unsavedCount,
    } = useDebouncedBuddyBidAssignments({
        planId: plan.id,
        calendar,
    });

    const saveStatusMessage = (() => {
        if (saveError) {
            return saveError;
        }

        if (saveState === 'saving') {
            return 'Saving overlap assignments…';
        }

        if (saveState === 'saved' && !hasUnsavedChanges) {
            return 'Overlap assignments saved.';
        }

        if (hasUnsavedChanges) {
            const minutes = Math.round(BUDDY_BID_AUTO_SAVE_MS / 60_000);
            return `${unsavedCount} unsaved overlap change${unsavedCount === 1 ? '' : 's'}. Auto-saving in about ${minutes} minute${minutes === 1 ? '' : 's'} after you stop clicking.`;
        }

        return 'Overlap assignments save automatically after you stop making changes.';
    })();

    const linesReady = participantForm.data.participants.every(
        (p) => p.bid_line_id > 0,
    );

    const saveParticipants = (e: React.FormEvent) => {
        e.preventDefault();
        participantForm.put(
            `/app/bid-tools/buddy-bids/${plan.id}/participants`,
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={plan.name} />
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {plan.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {plan.bid_year} · two-buddy double planning
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => {
                            if (
                                window.confirm(
                                    'Delete this buddy bid plan? This cannot be undone.',
                                )
                            ) {
                                router.delete(
                                    `/app/bid-tools/buddy-bids/${plan.id}`,
                                );
                            }
                        }}
                    >
                        Delete plan
                    </Button>
                </div>

                <form
                    onSubmit={saveParticipants}
                    className="space-y-4 rounded-lg border border-sidebar-border/70 p-4"
                >
                    <h2 className="text-sm font-medium">Buddies & lines</h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {participantForm.data.participants.map(
                            (participant, index) => (
                                <div
                                    key={participant.id ?? index}
                                    className="space-y-3 rounded-md border border-sidebar-border/50 bg-muted/10 p-3"
                                >
                                    <div className="space-y-2">
                                        <Label htmlFor={`name-${index}`}>
                                            Buddy {index + 1} name
                                        </Label>
                                        <Input
                                            id={`name-${index}`}
                                            value={participant.display_name}
                                            onChange={(e) => {
                                                const next = [
                                                    ...participantForm.data
                                                        .participants,
                                                ];
                                                next[index] = {
                                                    ...next[index],
                                                    display_name:
                                                        e.target.value,
                                                };
                                                participantForm.setData(
                                                    'participants',
                                                    next,
                                                );
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`line-${index}`}>
                                            Line
                                        </Label>
                                        <Select
                                            value={
                                                participant.bid_line_id
                                                    ? String(
                                                          participant.bid_line_id,
                                                      )
                                                    : ''
                                            }
                                            onValueChange={(v) => {
                                                const next = [
                                                    ...participantForm.data
                                                        .participants,
                                                ];
                                                next[index] = {
                                                    ...next[index],
                                                    bid_line_id: Number(v),
                                                };
                                                participantForm.setData(
                                                    'participants',
                                                    next,
                                                );
                                            }}
                                        >
                                            <SelectTrigger id={`line-${index}`}>
                                                <SelectValue placeholder="Select line" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lines.map((line) => (
                                                    <SelectItem
                                                        key={line.id}
                                                        value={String(line.id)}
                                                    >
                                                        {line.line_num}{' '}
                                                        {line.desk_group}{' '}
                                                        {line.start_time}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <DateListEditor
                                        idPrefix={`vacation-${index}`}
                                        label="Awarded vacation"
                                        description="Specific vacation days to count against balance."
                                        bidYear={plan.bid_year}
                                        dates={
                                            participant.profile.vacation_dates
                                        }
                                        onChange={(dates) => {
                                            const next = [
                                                ...participantForm.data
                                                    .participants,
                                            ];
                                            next[index] = {
                                                ...next[index],
                                                profile: {
                                                    ...next[index].profile,
                                                    vacation_dates: dates,
                                                },
                                            };
                                            participantForm.setData(
                                                'participants',
                                                next,
                                            );
                                        }}
                                    />
                                    <DateListEditor
                                        idPrefix={`pull-${index}`}
                                        label="Pull days"
                                        description="Days pulled off the line (treated like time off)."
                                        bidYear={plan.bid_year}
                                        dates={participant.profile.pull_dates}
                                        onChange={(dates) => {
                                            const next = [
                                                ...participantForm.data
                                                    .participants,
                                            ];
                                            next[index] = {
                                                ...next[index],
                                                profile: {
                                                    ...next[index].profile,
                                                    pull_dates: dates,
                                                },
                                            };
                                            participantForm.setData(
                                                'participants',
                                                next,
                                            );
                                        }}
                                    />
                                </div>
                            ),
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={participantForm.processing || !linesReady}
                    >
                        Save buddies & lines
                    </Button>
                </form>

                {linesReady ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border/70 bg-muted/10 px-4 py-3 text-sm">
                            <p
                                className={
                                    saveError
                                        ? 'text-destructive'
                                        : 'text-muted-foreground'
                                }
                            >
                                {saveStatusMessage}
                            </p>
                            {hasUnsavedChanges && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={saveState === 'saving'}
                                    onClick={() => void saveNow()}
                                >
                                    Save overlaps now
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={saveState === 'saving'}
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            'Clear all overlap assignments? Buddies, lines, and vacation/pull dates stay the same.',
                                        )
                                    ) {
                                        void resetAssignments();
                                    }
                                }}
                            >
                                Reset overlaps
                            </Button>
                        </div>
                        <BuddyBidSnapshotsPanel
                            planId={plan.id}
                            snapshots={snapshots}
                            hasUnsavedChanges={hasUnsavedChanges}
                            onSaveBeforeSnapshot={saveNow}
                        />
                        <BuddyBidSummaryPanel
                            summary={displayCalendar.summary}
                            balance={displayCalendar.balance}
                        />
                        <BuddyBidRotationPanel
                            calendar={displayCalendar}
                            currentAssignments={assignments}
                            onApply={applyRotationAssignments}
                        />
                        <BuddyBidCalendar
                            months={displayCalendar.months}
                            participants={displayCalendar.participants}
                            linesCanDouble={displayCalendar.lines_can_double}
                            shiftPairing={displayCalendar.shift_pairing}
                            onAssignOverlap={assignOverlap}
                        />
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Select a line for each buddy and save to open the
                        calendar.
                    </p>
                )}
            </div>
        </AppLayout>
    );
}
