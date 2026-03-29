import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Lines', href: '/app/bid-tools/lines' },
];

type LineRow = {
    id: number;
    line_num: string;
    desk_group: string;
    source_label: string | null;
    start_time: string;
    rotation: string | null;
    workdays_from_file: number | null;
    workdays_computed: number;
    metrics: {
        holidays_off: number;
        fri_off: number;
        sat_off: number;
        sun_off: number;
        fri_sat_sun_all_off: number;
        sat_sun_both_off: number;
    };
    rotation_analysis: {
        non_canonical_runs: number[];
        notes: string[];
    };
    training_summary: string;
    schedule_callouts: string;
};

export default function BidToolsLines({
    import: bidImport,
    lines,
    years,
}: {
    import: { id: number; bid_year: number; file_hash: string } | null;
    lines: LineRow[];
    years: number[];
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bid lines" />
            <div className="space-y-4 p-4 pb-12">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Line browser
                        </h1>
                        {bidImport ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                                Bid year {bidImport.bid_year} · import #
                                {bidImport.id}
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-muted-foreground">
                                No current import to show.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {years.length > 0 && (
                            <Select
                                value={
                                    bidImport
                                        ? String(bidImport.bid_year)
                                        : undefined
                                }
                                onValueChange={(v) => {
                                    window.location.href = `/app/bid-tools/lines?bid_year=${v}`;
                                }}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Bid year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={String(y)}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/app/bid-tools">Back to hub</Link>
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                    <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 font-medium">Line</th>
                                <th className="p-2 font-medium">Group</th>
                                <th className="p-2 font-medium">Source</th>
                                <th className="p-2 font-medium">Start</th>
                                <th className="p-2 font-medium">Rot</th>
                                <th className="p-2 font-medium">WD</th>
                                <th className="p-2 font-medium">Hol off</th>
                                <th className="p-2 font-medium">F/Sa/Su</th>
                                <th className="max-w-[200px] p-2 font-medium">
                                    Training (SP/FA + TAM/TPM + date)
                                </th>
                                <th className="max-w-[280px] p-2 font-medium">
                                    Schedule callouts
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-sidebar-border/40"
                                >
                                    <td className="p-2 font-mono text-xs">
                                        {row.line_num}
                                    </td>
                                    <td className="p-2">{row.desk_group}</td>
                                    <td className="max-w-[140px] p-2 text-xs text-muted-foreground">
                                        {row.source_label ?? '—'}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {row.start_time}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {row.rotation ?? '—'}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {row.workdays_from_file ??
                                            row.workdays_computed}
                                    </td>
                                    <td className="p-2">
                                        {row.metrics.holidays_off}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {row.metrics.fri_off}/
                                        {row.metrics.sat_off}/
                                        {row.metrics.sun_off}
                                        <div className="text-muted-foreground">
                                            F–Su{' '}
                                            {row.metrics.fri_sat_sun_all_off} ·
                                            Sa–Su {row.metrics.sat_sun_both_off}
                                        </div>
                                    </td>
                                    <td className="max-w-[220px] p-2 text-xs leading-snug">
                                        {row.training_summary}
                                    </td>
                                    <td className="max-w-[280px] p-2 text-xs leading-snug text-muted-foreground">
                                        {row.schedule_callouts}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
