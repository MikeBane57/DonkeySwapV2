import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Participant = {
    id: number;
    display_name: string;
    seniority_rank: number;
    minimum_bid_lines: number;
    bid_scenario_id: number;
    scenario_name: string | null;
};

type ScenarioOption = {
    id: number;
    name: string;
};

export default function BidSimulationEdit({
    simulation,
    participants,
    scenarios,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
        import_title: string | null;
    };
    participants: Participant[];
    scenarios: ScenarioOption[];
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        { title: simulation.name, href: `/app/bid-tools/simulations/${simulation.id}` },
        { title: 'Manage', href: '#' },
    ];

    const nameForm = useForm({ name: simulation.name });
    const participantForm = useForm({
        display_name: '',
        seniority_rank: participants.length + 1,
        bid_scenario_id: scenarios[0]?.id ?? 0,
    });

    const addParticipant = (e: React.FormEvent) => {
        e.preventDefault();
        participantForm.post(
            `/app/bid-tools/simulations/${simulation.id}/participants`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    participantForm.reset();
                    participantForm.setData(
                        'seniority_rank',
                        participants.length + 2,
                    );
                },
            },
        );
    };

    const removeParticipant = (participantId: number) => {
        if (!confirm('Remove this bidder from the simulation?')) {
            return;
        }
        router.delete(
            `/app/bid-tools/simulations/${simulation.id}/participants/${participantId}`,
            { preserveScroll: true },
        );
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
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/app/bid-tools/simulations/${simulation.id}`}>
                            View simulation
                        </Link>
                    </Button>
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
                            <Label htmlFor="sim-name" className="sr-only">
                                Name
                            </Label>
                            <Input
                                id="sim-name"
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
                        bid sheet. #20 needs at least 20 lines ranked.
                    </p>
                    {participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No bidders yet. Add one below.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {participants.map((p) => (
                                <li
                                    key={p.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3 text-sm"
                                >
                                    <div>
                                        <span className="font-medium">
                                            #{p.seniority_rank} {p.display_name}
                                        </span>
                                        <span className="ml-2 text-muted-foreground">
                                            min {p.minimum_bid_lines} line
                                            {p.minimum_bid_lines === 1
                                                ? ''
                                                : 's'}
                                            {' · '}
                                            {p.scenario_name ?? 'No profile'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link
                                                href={`/app/bid-tools/simulations/${simulation.id}/participants/${p.id}/recommendations`}
                                            >
                                                Bid order
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() =>
                                                removeParticipant(p.id)
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Add bidder</h2>
                    {scenarios.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Create a preference profile (scenario) for this bid
                            year first, then link it here.{' '}
                            <Link
                                href="/app/bid-tools/scenarios/create"
                                className="underline"
                            >
                                New scenario
                            </Link>
                        </p>
                    ) : (
                        <form className="space-y-4" onSubmit={addParticipant}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="display_name">Name</Label>
                                    <Input
                                        id="display_name"
                                        value={participantForm.data.display_name}
                                        onChange={(e) =>
                                            participantForm.setData(
                                                'display_name',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="e.g. Jane Smith"
                                    />
                                    {participantForm.errors.display_name && (
                                        <p className="text-sm text-destructive">
                                            {
                                                participantForm.errors
                                                    .display_name
                                            }
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
                                        value={
                                            participantForm.data.seniority_rank
                                        }
                                        onChange={(e) =>
                                            participantForm.setData(
                                                'seniority_rank',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Also minimum lines to rank on bid sheet
                                    </p>
                                    {participantForm.errors.seniority_rank && (
                                        <p className="text-sm text-destructive">
                                            {
                                                participantForm.errors
                                                    .seniority_rank
                                            }
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bid_scenario_id">
                                    Preference profile (scenario)
                                </Label>
                                <select
                                    id="bid_scenario_id"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                    value={String(
                                        participantForm.data.bid_scenario_id,
                                    )}
                                    onChange={(e) =>
                                        participantForm.setData(
                                            'bid_scenario_id',
                                            Number(e.target.value),
                                        )
                                    }
                                >
                                    {scenarios.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                {participantForm.errors.bid_scenario_id && (
                                    <p className="text-sm text-destructive">
                                        {
                                            participantForm.errors
                                                .bid_scenario_id
                                        }
                                    </p>
                                )}
                            </div>
                            <Button
                                type="submit"
                                disabled={participantForm.processing}
                            >
                                Add bidder
                            </Button>
                        </form>
                    )}
                </section>
            </div>
        </AppLayout>
    );
}
