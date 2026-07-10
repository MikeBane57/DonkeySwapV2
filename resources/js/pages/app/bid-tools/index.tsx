import { Head, Link, router } from '@inertiajs/react';
import {
    Copy,
    GitCompare,
    ListOrdered,
    Play,
    Plus,
    Table,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type CurrentImport = {
    id: number;
    bid_year: number;
    file_hash: string;
    original_filename: string;
    title: string | null;
    created_at: string;
    distinct_codes_count: number;
    source_file_count: number;
};

type ScenarioRow = {
    id: number;
    name: string;
    bid_year: number;
    import_stale: boolean;
    updated_at: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
];

type SimulationRow = {
    id: number;
    name: string;
    bid_year: number;
    participants_count: number;
    last_run_at: string | null;
};

type BuddyBidRow = {
    id: number;
    name: string;
    bid_year: number;
    updated_at: string;
};

export default function BidToolsIndex({
    currentImports,
    scenarios,
    simulations = [],
    buddyBids = [],
}: {
    currentImports: CurrentImport[];
    scenarios: ScenarioRow[];
    simulations?: SimulationRow[];
    buddyBids?: BuddyBidRow[];
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bid tools" />
            <div className="mx-auto max-w-3xl space-y-8 p-4 pb-12">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Bid tools
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Compare bid lines against your preferences, vacation
                        windows, and holidays. Master line spreadsheet is
                        uploaded by an admin.
                    </p>
                </div>

                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Current master import
                    </h2>
                    {currentImports.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            No master file for any bid year yet. Ask an admin to
                            upload a CSV or XLSX under Admin → Bid line import.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {currentImports.map((i) => (
                                <li
                                    key={i.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3 text-sm"
                                >
                                    <div>
                                        <span className="font-medium">
                                            Bid year {i.bid_year}
                                        </span>
                                        {i.title && (
                                            <span className="ml-2 font-normal text-foreground">
                                                · {i.title}
                                            </span>
                                        )}
                                        <span className="ml-2 text-muted-foreground">
                                            {i.original_filename}
                                        </span>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {i.source_file_count > 0 &&
                                                `${i.source_file_count} source file${i.source_file_count === 1 ? '' : 's'} · `}
                                            {i.distinct_codes_count} distinct
                                            work codes · hash{' '}
                                            <code className="rounded bg-muted px-1">
                                                {i.file_hash.slice(0, 12)}…
                                            </code>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/lines?bid_year=${i.bid_year}`}
                                        >
                                            <Table className="mr-2 h-4 w-4" />
                                            Browse lines
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Your scenarios
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {scenarios.length >= 2 && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/app/bid-tools/scenarios/compare">
                                        <GitCompare className="mr-2 h-4 w-4" />
                                        Compare scenarios
                                    </Link>
                                </Button>
                            )}
                            <Button size="sm" asChild>
                                <Link href="/app/bid-tools/scenarios/create">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New scenario
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {scenarios.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Create a scenario to set vacation ranges, weights,
                            and ranking preferences.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {scenarios.map((s) => (
                                <li
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {s.name}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                · bid {s.bid_year}
                                            </span>
                                            {s.import_stale && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                                                    <TriangleAlert className="h-3 w-3" />
                                                    Stale import
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link
                                                href={`/app/bid-tools/scenarios/${s.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    `/app/bid-tools/scenarios/${s.id}/duplicate`,
                                                )
                                            }
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Duplicate
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link
                                                href={`/app/bid-tools/scenarios/${s.id}/ranked`}
                                            >
                                                <ListOrdered className="mr-2 h-4 w-4" />
                                                Rank lines
                                            </Link>
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Bid simulator
                        </h2>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/app/bid-tools/simulations/create">
                                <Plus className="mr-2 h-4 w-4" />
                                New simulation
                            </Link>
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Model seniority bids: assign preference profiles per
                        person, get suggested bid orders, and simulate picks.
                    </p>
                    {simulations.length === 0 ? (
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/app/bid-tools/simulations">
                                Open bid simulator
                            </Link>
                        </Button>
                    ) : (
                        <ul className="space-y-2">
                            {simulations.map((s) => (
                                <li
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3"
                                >
                                    <div>
                                        <span className="font-medium">
                                            {s.name}
                                        </span>
                                        <span className="ml-2 text-sm text-muted-foreground">
                                            bid {s.bid_year} ·{' '}
                                            {s.participants_count} bidder
                                            {s.participants_count === 1
                                                ? ''
                                                : 's'}
                                        </span>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/simulations/${s.id}`}
                                        >
                                            <Play className="mr-2 h-4 w-4" />
                                            Open
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                            <li>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href="/app/bid-tools/simulations">
                                        View all simulations
                                    </Link>
                                </Button>
                            </li>
                        </ul>
                    )}
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Buddy bids
                        </h2>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/app/bid-tools/buddy-bids/create">
                                <Plus className="mr-2 h-4 w-4" />
                                New buddy plan
                            </Link>
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Two-buddy year planning: overlay lines, assign doubles on
                        overlap days, and track balance.
                    </p>
                    {buddyBids.length === 0 ? (
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/app/bid-tools/buddy-bids">
                                Open buddy bids
                            </Link>
                        </Button>
                    ) : (
                        <ul className="space-y-2">
                            {buddyBids.map((plan) => (
                                <li
                                    key={plan.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3"
                                >
                                    <div>
                                        <span className="font-medium">
                                            {plan.name}
                                        </span>
                                        <span className="ml-2 text-sm text-muted-foreground">
                                            bid {plan.bid_year}
                                        </span>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/buddy-bids/${plan.id}`}
                                        >
                                            <Users className="mr-2 h-4 w-4" />
                                            Open
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                            <li>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href="/app/bid-tools/buddy-bids">
                                        View all buddy plans
                                    </Link>
                                </Button>
                            </li>
                        </ul>
                    )}
                </section>
            </div>
        </AppLayout>
    );
}
