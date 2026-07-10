import { Head, Link } from '@inertiajs/react';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Buddy bids', href: '/app/bid-tools/buddy-bids' },
];

type PlanRow = {
    id: number;
    name: string;
    bid_year: number;
    participants_count: number;
    updated_at: string;
};

export default function BuddyBidsIndex({ plans }: { plans: PlanRow[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buddy bids" />
            <div className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Buddy bids
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Plan a two-buddy year: overlay lines, assign doubles
                            on overlap days, and track balance.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/app/bid-tools/buddy-bids/create">
                            <Plus className="mr-2 h-4 w-4" />
                            New plan
                        </Link>
                    </Button>
                </div>

                {plans.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        No buddy bid plans yet. Create one to pick two lines and
                        start coordinating doubles.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {plans.map((plan) => (
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
                    </ul>
                )}
            </div>
        </AppLayout>
    );
}
