import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/app' },
    { title: 'Review schedule', href: '/app/reconcile-schedule' },
];

type ReconcileItem = {
    id: number;
    type: string;
    shift_id: number | null;
    snapshot: Record<string, unknown> | null;
    user_action: string | null;
    reason: string | null;
    shift: {
        id: number;
        position_name: string;
        desk_type: string;
        start_time_utc: string;
        end_time_utc: string;
    } | null;
};

type Reconciliation = {
    id: number;
    created_at: string;
    items: ReconcileItem[];
} | null;

function formatUtc(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso.slice(0, 16);
    }
}

function buildDefaultActions(
    rec: Reconciliation,
): Record<string, { action: string; reason: string }> {
    if (!rec?.items) return {};
    const d: Record<string, { action: string; reason: string }> = {};
    rec.items.forEach((i) => {
        if (i.type === 'added')
            d[String(i.id)] = { action: 'accepted', reason: '' };
        if (i.type === 'removed')
            d[String(i.id)] = { action: 'removed', reason: '' };
    });
    return d;
}

function ReconcileScheduleContent({
    reconciliation,
    message,
}: {
    reconciliation: Reconciliation;
    message: string;
}) {
    const [actions, setActions] = useState<
        Record<string, { action: string; reason: string }>
    >(() => buildDefaultActions(reconciliation));
    const [submitting, setSubmitting] = useState(false);
    const [view, setView] = useState<'calendar' | 'table'>('calendar');

    const setAction = (itemId: number, action: string, reason: string = '') => {
        setActions((prev) => ({
            ...prev,
            [String(itemId)]: { action, reason },
        }));
    };

    const items = useMemo(
        () => reconciliation?.items ?? [],
        [reconciliation?.items],
    );
    const added = useMemo(
        () => items.filter((i) => i.type === 'added'),
        [items],
    );
    const removed = useMemo(
        () => items.filter((i) => i.type === 'removed'),
        [items],
    );

    const calendarEvents = useMemo(() => {
        const evs: {
            id: string;
            title: string;
            start: string;
            end: string;
            backgroundColor: string;
        }[] = [];
        added.forEach((i) => {
            if (i.shift?.start_time_utc && i.shift?.end_time_utc) {
                evs.push({
                    id: `added-${i.id}`,
                    title: `+ ${i.shift.position_name}`,
                    start: i.shift.start_time_utc,
                    end: i.shift.end_time_utc,
                    backgroundColor: 'rgb(34 197 94)',
                });
            }
        });
        removed.forEach((i) => {
            const snap = i.snapshot as {
                position_name?: string;
                start_time_utc?: string;
                end_time_utc?: string;
            } | null;
            const shift = i.shift;
            const start = shift?.start_time_utc ?? snap?.start_time_utc;
            const end = shift?.end_time_utc ?? snap?.end_time_utc;
            const name = shift?.position_name ?? snap?.position_name ?? 'Shift';
            if (start) {
                const endIso =
                    end ??
                    (() => {
                        const d = new Date(start);
                        d.setHours(d.getHours() + 8);
                        return d.toISOString();
                    })();
                evs.push({
                    id: `removed-${i.id}`,
                    title: `− ${name}`,
                    start,
                    end: endIso,
                    backgroundColor: 'rgb(245 158 11)',
                });
            }
        });
        return evs;
    }, [added, removed]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reconciliation?.id) return;
        setSubmitting(true);
        router.post(
            `/app/reconcile-schedule/${reconciliation.id}`,
            { actions },
            { onFinish: () => setSubmitting(false) },
        );
    };

    if (!reconciliation) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Review schedule" />
                <div className="p-4">
                    <p className="text-muted-foreground">{message}</p>
                    <Button asChild className="mt-4">
                        <a href="/app">Back to dashboard</a>
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Review schedule discrepancies" />
            <div className="space-y-6 p-4">
                <h1 className="text-xl font-semibold">
                    Review schedule discrepancies
                </h1>
                <p className="text-muted-foreground">{message}</p>

                <div className="mb-4 flex gap-1 border-b border-border">
                    <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${view === 'calendar' ? '-mb-px border border-b-0 border-border bg-muted' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Calendar
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('table')}
                        className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${view === 'table' ? '-mb-px border border-b-0 border-border bg-muted' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Table
                    </button>
                </div>

                {view === 'calendar' &&
                    (calendarEvents.length > 0 ? (
                        <section className="rounded-lg border border-border bg-card p-4">
                            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                                Changes on calendar
                            </h2>
                            <div className="min-h-[320px]">
                                <FullCalendar
                                    plugins={[dayGridPlugin]}
                                    initialView="dayGridMonth"
                                    headerToolbar={{
                                        left: 'title',
                                        right: 'prev,next today',
                                    }}
                                    events={calendarEvents}
                                    eventContent={(arg) => (
                                        <div
                                            className="truncate rounded px-1 py-0.5 text-xs text-white"
                                            style={{
                                                backgroundColor:
                                                    arg.event.backgroundColor,
                                            }}
                                        >
                                            {arg.event.title}
                                        </div>
                                    )}
                                    height="auto"
                                    contentHeight="auto"
                                    aspectRatio={1.6}
                                />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>
                                    <span
                                        className="mr-1 inline-block h-3 w-3 rounded align-middle"
                                        style={{
                                            backgroundColor: 'rgb(34 197 94)',
                                        }}
                                    />{' '}
                                    Add to board
                                </span>
                                <span>
                                    <span
                                        className="mr-1 inline-block h-3 w-3 rounded align-middle"
                                        style={{
                                            backgroundColor: 'rgb(245 158 11)',
                                        }}
                                    />{' '}
                                    Remove from board
                                </span>
                            </div>
                        </section>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No changes to show on calendar. Use the Table tab to
                            review and submit.
                        </p>
                    ))}

                {view === 'table' && (
                    <form
                        onSubmit={handleSubmit}
                        className="max-w-3xl space-y-6"
                    >
                        {added.length > 0 && (
                            <section>
                                <h2 className="mb-2 font-medium text-green-700 dark:text-green-400">
                                    Workzone shifts not on your board in this
                                    app
                                </h2>
                                <p className="mb-2 text-sm text-muted-foreground">
                                    These shifts are in workzone but not on your
                                    board here. Accept to add them, or reject
                                    and say why.
                                </p>
                                <ul className="space-y-3">
                                    {added.map((i) => (
                                        <li
                                            key={i.id}
                                            className="rounded-lg border border-border p-3"
                                        >
                                            {i.shift && (
                                                <p className="text-sm">
                                                    {i.shift.position_name} ·{' '}
                                                    {formatUtc(
                                                        i.shift.start_time_utc,
                                                    )}
                                                </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={
                                                        (actions[String(i.id)]
                                                            ?.action ??
                                                            'accepted') ===
                                                        'accepted'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    onClick={() =>
                                                        setAction(
                                                            i.id,
                                                            'accepted',
                                                        )
                                                    }
                                                >
                                                    Accept
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={
                                                        (actions[String(i.id)]
                                                            ?.action ?? '') ===
                                                        'rejected'
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                    onClick={() =>
                                                        setAction(
                                                            i.id,
                                                            'rejected',
                                                        )
                                                    }
                                                >
                                                    Reject
                                                </Button>
                                                {(actions[String(i.id)]
                                                    ?.action ?? '') ===
                                                    'rejected' && (
                                                    <span className="inline-flex items-center gap-2">
                                                        <Label
                                                            htmlFor={`reason-${i.id}`}
                                                            className="text-xs"
                                                        >
                                                            Why?
                                                        </Label>
                                                        <Input
                                                            id={`reason-${i.id}`}
                                                            className="h-8 w-48 text-sm"
                                                            value={
                                                                actions[
                                                                    String(i.id)
                                                                ]?.reason ?? ''
                                                            }
                                                            onChange={(e) =>
                                                                setAction(
                                                                    i.id,
                                                                    'rejected',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Reason (required)"
                                                        />
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {removed.length > 0 && (
                            <section>
                                <h2 className="mb-2 font-medium text-amber-700 dark:text-amber-400">
                                    Shifts missing from workzone
                                </h2>
                                <p className="mb-2 text-sm text-muted-foreground">
                                    These shifts are on your board here but
                                    missing from workzone. Confirm removal, or
                                    keep and say why.
                                </p>
                                <ul className="space-y-3">
                                    {removed.map((i) => {
                                        const snap = i.snapshot as {
                                            position_name?: string;
                                            start_time_utc?: string;
                                        } | null;
                                        return (
                                            <li
                                                key={i.id}
                                                className="rounded-lg border border-border p-3"
                                            >
                                                {snap && (
                                                    <p className="text-sm">
                                                        {snap.position_name ??
                                                            'Shift'}{' '}
                                                        ·{' '}
                                                        {snap.start_time_utc
                                                            ? formatUtc(
                                                                  snap.start_time_utc,
                                                              )
                                                            : '—'}
                                                    </p>
                                                )}
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={
                                                            (actions[
                                                                String(i.id)
                                                            ]?.action ??
                                                                'removed') ===
                                                            'removed'
                                                                ? 'default'
                                                                : 'outline'
                                                        }
                                                        onClick={() =>
                                                            setAction(
                                                                i.id,
                                                                'removed',
                                                            )
                                                        }
                                                    >
                                                        Confirm remove
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={
                                                            (actions[
                                                                String(i.id)
                                                            ]?.action ?? '') ===
                                                            'kept'
                                                                ? 'default'
                                                                : 'outline'
                                                        }
                                                        onClick={() =>
                                                            setAction(
                                                                i.id,
                                                                'kept',
                                                            )
                                                        }
                                                    >
                                                        Keep shift
                                                    </Button>
                                                    {(actions[String(i.id)]
                                                        ?.action ?? '') ===
                                                        'kept' && (
                                                        <span className="inline-flex items-center gap-2">
                                                            <Label
                                                                htmlFor={`reason-${i.id}`}
                                                                className="text-xs"
                                                            >
                                                                Why?
                                                            </Label>
                                                            <Input
                                                                id={`reason-${i.id}`}
                                                                className="h-8 w-48 text-sm"
                                                                value={
                                                                    actions[
                                                                        String(
                                                                            i.id,
                                                                        )
                                                                    ]?.reason ??
                                                                    ''
                                                                }
                                                                onChange={(e) =>
                                                                    setAction(
                                                                        i.id,
                                                                        'kept',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="Reason (required)"
                                                            />
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}

                        <div className="flex gap-2">
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Saving…' : 'Submit review'}
                            </Button>
                            <Button type="button" variant="outline" asChild>
                                <a href="/app">Cancel</a>
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </AppLayout>
    );
}

export default function ReconcileSchedule(props: {
    reconciliation: Reconciliation;
    message: string;
}) {
    return (
        <ReconcileScheduleContent
            key={props.reconciliation?.id ?? 'none'}
            {...props}
        />
    );
}
