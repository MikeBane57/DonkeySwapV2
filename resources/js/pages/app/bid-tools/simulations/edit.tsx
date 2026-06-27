import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import {
    BidderProfileFields,
    emptyBidderProfile
    
} from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import type {BidderProfile} from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import type { BreadcrumbItem } from '@/types';

type Participant = {
    id: number;
    display_name: string;
    seniority_rank: number;
    minimum_bid_lines: number;
    profile: BidderProfile;
};

function sanitizeProfile(profile: BidderProfile): BidderProfile {
    return {
        ...profile,
        personal_dates: profile.personal_dates.filter((p) => p.date),
        vacation_ranges: profile.vacation_ranges.filter(
            (r) => r.starts_on && r.ends_on,
        ),
    };
}

function ParticipantEditor({
    simulationId,
    participant,
}: {
    simulationId: number;
    participant: Participant;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        display_name: participant.display_name,
        seniority_rank: participant.seniority_rank,
        profile: participant.profile,
    });

    const save = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            profile: sanitizeProfile(data.profile),
        }));
        form.put(
            `/app/bid-tools/simulations/${simulationId}/participants/${participant.id}`,
            { preserveScroll: true },
        );
    };

    const remove = () => {
        if (!confirm(`Remove ${participant.display_name} from this simulation?`)) {
            return;
        }
        router.delete(
            `/app/bid-tools/simulations/${simulationId}/participants/${participant.id}`,
            { preserveScroll: true },
        );
    };

    return (
        <div className="rounded-lg border border-sidebar-border/70">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
                onClick={() => setOpen((v) => !v)}
            >
                <span>
                    <span className="font-medium">
                        #{participant.seniority_rank} {participant.display_name}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                        min {participant.minimum_bid_lines} line
                        {participant.minimum_bid_lines === 1 ? '' : 's'}
                    </span>
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <form className="space-y-4 border-t border-sidebar-border/50 p-3" onSubmit={save}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={form.data.display_name}
                                onChange={(e) =>
                                    form.setData('display_name', e.target.value)
                                }
                            />
                            {form.errors.display_name && (
                                <p className="text-sm text-destructive">
                                    {form.errors.display_name}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Seniority rank</Label>
                            <Input
                                type="number"
                                min={1}
                                value={form.data.seniority_rank}
                                onChange={(e) =>
                                    form.setData(
                                        'seniority_rank',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            {form.errors.seniority_rank && (
                                <p className="text-sm text-destructive">
                                    {form.errors.seniority_rank}
                                </p>
                            )}
                        </div>
                    </div>

                    <BidderProfileFields
                        idPrefix={`p-${participant.id}`}
                        value={form.data.profile}
                        onChange={(profile) => form.setData('profile', profile)}
                    />

                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" disabled={form.processing}>
                            Save bidder
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/simulations/${simulationId}/participants/${participant.id}/recommendations`}
                            >
                                Suggested bid order
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={remove}
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default function BidSimulationEdit({
    simulation,
    profile_defaults: profileDefaults,
    participants,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
        import_title: string | null;
    };
    profile_defaults: BidderProfile;
    participants: Participant[];
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        { title: simulation.name, href: `/app/bid-tools/simulations/${simulation.id}` },
        { title: 'Manage', href: '#' },
    ];

    const nameForm = useForm({ name: simulation.name });
    const addForm = useForm({
        display_name: '',
        seniority_rank: participants.length + 1,
        profile: emptyBidderProfile(profileDefaults),
    });

    const addParticipant = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.transform((data) => ({
            ...data,
            profile: sanitizeProfile(data.profile),
        }));
        addForm.post(`/app/bid-tools/simulations/${simulation.id}/participants`, {
            preserveScroll: true,
            onSuccess: () => {
                addForm.reset();
                addForm.setData({
                    display_name: '',
                    seniority_rank: participants.length + 2,
                    profile: emptyBidderProfile(profileDefaults),
                });
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Manage · ${simulation.name}`} />
            <div className="mx-auto max-w-3xl space-y-8 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {simulation.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {simulation.bid_year}
                            {simulation.import_title
                                ? ` · ${simulation.import_title}`
                                : ''}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/app/bid-tools/simulations/${simulation.id}`}>
                                View simulation
                            </Link>
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                                if (
                                    confirm(
                                        `Delete "${simulation.name}" and all its bidders? This cannot be undone.`,
                                    )
                                ) {
                                    router.delete(
                                        `/app/bid-tools/simulations/${simulation.id}`,
                                    );
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete simulation
                        </Button>
                    </div>
                </div>

                {page.props.flash?.success && (
                    <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                        {page.props.flash.success}
                    </p>
                )}

                <section className="space-y-3 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Simulation name</h2>
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            nameForm.put(
                                `/app/bid-tools/simulations/${simulation.id}`,
                            );
                        }}
                    >
                        <div className="min-w-[200px] flex-1 space-y-1">
                            <Input
                                value={nameForm.data.name}
                                onChange={(e) =>
                                    nameForm.setData('name', e.target.value)
                                }
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={nameForm.processing}
                        >
                            Save name
                        </Button>
                    </form>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Bidders ({participants.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Seniority #1 picks first and only needs 1 line on their
                        bid sheet. #20 needs at least 20 lines ranked. Expand a
                        bidder to edit their preferences inline.
                    </p>
                    {participants.length > 0 && (
                        <div className="space-y-2">
                            {participants.map((p) => (
                                <ParticipantEditor
                                    key={p.id}
                                    simulationId={simulation.id}
                                    participant={p}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Add bidder</h2>
                    <form className="space-y-4" onSubmit={addParticipant}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="display_name">Name</Label>
                                <Input
                                    id="display_name"
                                    value={addForm.data.display_name}
                                    onChange={(e) =>
                                        addForm.setData(
                                            'display_name',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. Jane Smith"
                                />
                                {addForm.errors.display_name && (
                                    <p className="text-sm text-destructive">
                                        {addForm.errors.display_name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="seniority_rank">
                                    Seniority rank
                                </Label>
                                <Input
                                    id="seniority_rank"
                                    type="number"
                                    min={1}
                                    value={addForm.data.seniority_rank}
                                    onChange={(e) =>
                                        addForm.setData(
                                            'seniority_rank',
                                            Number(e.target.value),
                                        )
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Also minimum lines to rank on bid sheet
                                </p>
                                {addForm.errors.seniority_rank && (
                                    <p className="text-sm text-destructive">
                                        {addForm.errors.seniority_rank}
                                    </p>
                                )}
                            </div>
                        </div>

                        <BidderProfileFields
                            idPrefix="new-bidder"
                            value={addForm.data.profile}
                            onChange={(profile) =>
                                addForm.setData('profile', profile)
                            }
                        />

                        <Button type="submit" disabled={addForm.processing}>
                            Add bidder
                        </Button>
                    </form>
                </section>
            </div>
        </AppLayout>
    );
}
