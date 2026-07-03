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
import {
    formatWeekendBlockMetrics,
    formatWeekendMetrics,
    type LineMetrics,
} from '@/pages/app/bid-tools/holiday-metrics';
import { KeyHolidayCell } from '@/pages/app/bid-tools/key-holiday-cell';
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
    metrics: LineMetrics;
    rotation_analysis: {
        non_canonical_runs: number[];
        notes: string[];
    };
    training_summary: string;
    schedule_callouts: string;
};

function WeekendMetricsCell({ metrics }: { metrics: LineMetrics }) {
    const septFeb = metrics.sept_feb;

    return (
        <div>
            <div>{formatWeekendMetrics(metrics)}</div>
            <div className="text-muted-foreground">
                F–Su {metrics.fri_sat_sun_all_off} · Sa–Su{' '}
                {metrics.sat_sun_both_off}
            </div>
            {septFeb && (
                <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                        Sep–Feb:
                    </span>{' '}
                    {formatWeekendMetrics(septFeb)}
                    <div>{formatWeekendBlockMetrics(septFeb)}</div>
                </div>
            )}
        </div>
    );
}

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
            <div className="mx-auto max-w-6xl space-y-4 p-4 pb-12">
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
                        <p className="mt-1 text-xs text-muted-foreground">
                            Xmas, T&apos;giving, and Jul 4 show whether those
                            holiday dates are off, with days-off context for the
                            primary date. F/Sa/Su counts are full bid year; Sep–Feb
                            shows the fall/winter months only.
                        </p>
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

                <div className="space-y-3 md:hidden">
                    {lines.map((row) => (
                        <article
                            key={row.id}
                            className="rounded-lg border border-sidebar-border/60 bg-card p-3"
                        >
                            <p className="font-mono text-sm font-medium">
                                {row.line_num}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {row.desk_group} · {row.start_time}
                                {row.rotation ? ` · ${row.rotation}` : ''}
                            </p>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        Workdays
                                    </dt>
                                    <dd>
                                        {row.workdays_from_file ??
                                            row.workdays_computed}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        Hol off
                                    </dt>
                                    <dd>{row.metrics.holidays_off}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        Xmas
                                    </dt>
                                    <dd>
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays
                                                    ?.christmas
                                            }
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        T&apos;giving
                                    </dt>
                                    <dd>
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays
                                                    ?.thanksgiving
                                            }
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        Jul 4
                                    </dt>
                                    <dd>
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays?.july_4
                                            }
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                        F / Sa / Su
                                    </dt>
                                    <dd>
                                        <WeekendMetricsCell
                                            metrics={row.metrics}
                                        />
                                    </dd>
                                </div>
                            </dl>
                            {row.source_label && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Source: {row.source_label}
                                </p>
                            )}
                            {row.training_summary && (
                                <p className="mt-2 text-xs leading-snug">
                                    {row.training_summary}
                                </p>
                            )}
                            {row.schedule_callouts && (
                                <p className="mt-2 text-xs leading-snug whitespace-pre-wrap text-muted-foreground">
                                    {row.schedule_callouts}
                                </p>
                            )}
                        </article>
                    ))}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border border-sidebar-border/70 md:block">
                    <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 font-medium">Line</th>
                                <th className="p-2 font-medium">Group</th>
                                <th className="p-2 font-medium">Source</th>
                                <th className="p-2 font-medium">Start</th>
                                <th className="p-2 font-medium">Rot</th>
                                <th className="p-2 font-medium">WD</th>
                                <th className="p-2 font-medium">Hol off</th>
                                <th className="p-2 font-medium">Xmas</th>
                                <th className="p-2 font-medium">T&apos;giving</th>
                                <th className="p-2 font-medium">Jul 4</th>
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
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays
                                                    ?.christmas
                                            }
                                        />
                                    </td>
                                    <td className="p-2 text-xs">
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays
                                                    ?.thanksgiving
                                            }
                                        />
                                    </td>
                                    <td className="p-2 text-xs">
                                        <KeyHolidayCell
                                            group={
                                                row.metrics.key_holidays?.july_4
                                            }
                                        />
                                    </td>
                                    <td className="p-2 text-xs">
                                        <WeekendMetricsCell
                                            metrics={row.metrics}
                                        />
                                    </td>
                                    <td className="max-w-[220px] p-2 text-xs leading-snug">
                                        {row.training_summary}
                                    </td>
                                    <td className="max-w-[320px] p-2 text-xs leading-snug whitespace-pre-wrap text-muted-foreground">
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
