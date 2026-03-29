import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { Head, usePage } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ScheduleCalendarShiftEventContent } from '@/components/schedule-calendar-shift-event-content';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { logClientError } from '@/lib/client-logger';
import {
    colorIndexForUserId,
    OTHERS_BOARD_LEGEND_HEX,
    OTHERS_BOARD_PALETTE,
} from '@/lib/others-boards-palette';
import { normalizeShiftEventEndIso } from '@/lib/schedule-calendar-shift-display';
import { dashboard, othersBoards } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'My Schedule', href: dashboard().url },
    { title: "Others' boards", href: othersBoards().url },
];

type TimeOffRange = {
    id: number;
    title?: string | null;
    start_date: string;
    end_date: string;
    notes?: string | null;
};

type LfwDateRangeRow = {
    id: number;
    title?: string | null;
    dateFrom: string;
    dateTo: string;
};

type CalendarEvent = {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay?: boolean;
    extendedProps?: {
        shiftId?: number;
        position_name?: string;
        desk_type?: string | null;
        regulatory?: boolean;
        is_training?: boolean;
        posts?: { type: string }[];
        workgroup_id?: number | null;
        workgroup_name?: string;
        overlayUserId?: number;
        overlayUserName?: string;
        isOverlayOther?: boolean;
        isOverlayTimeOff?: boolean;
        isOverlayLfw?: boolean;
        isOverlayLfwPost?: boolean;
        isLfwRange?: boolean;
        isLfwPost?: boolean;
        notes?: string | null;
    };
};

function timeOffToCalendarEvents(ranges: TimeOffRange[]): Array<{
    id: string;
    start: string;
    end: string;
    title: string;
    allDay: boolean;
    backgroundColor: string;
    extendedProps?: { isTimeOff: true };
}> {
    return ranges.map((r) => {
        const end = new Date(r.end_date + 'T12:00:00');
        const title = r.title?.trim() || r.notes?.trim() || 'Need off';
        const endExclusive = new Date(end);
        endExclusive.setDate(endExclusive.getDate() + 1);
        return {
            id: `timeoff-${r.id}`,
            start: r.start_date,
            end: endExclusive.toISOString().slice(0, 10),
            title,
            allDay: true,
            backgroundColor: 'rgba(148, 163, 184, 0.25)',
            extendedProps: { isTimeOff: true },
        };
    });
}

function lfwToCalendarEvents(ranges: LfwDateRangeRow[]): Array<{
    id: string;
    start: string;
    end: string;
    title: string;
    allDay: boolean;
    backgroundColor: string;
    extendedProps?: { isLfwRange: true };
}> {
    return ranges.map((r) => {
        const end = new Date(r.dateTo + 'T12:00:00');
        const endExclusive = new Date(end);
        endExclusive.setDate(endExclusive.getDate() + 1);
        const title = r.title?.trim() || 'Looking for work';
        return {
            id: `lfw-${r.id}`,
            start: r.dateFrom,
            end: endExclusive.toISOString().slice(0, 10),
            title,
            allDay: true,
            backgroundColor: 'rgba(251, 191, 36, 0.28)',
            extendedProps: { isLfwRange: true },
        };
    });
}

function normalizeEventEnd(ev: CalendarEvent): CalendarEvent {
    if (
        ev.allDay ||
        ev.extendedProps?.isLfwPost ||
        ev.extendedProps?.isOverlayTimeOff ||
        ev.extendedProps?.isOverlayLfw ||
        ev.extendedProps?.isOverlayLfwPost
    ) {
        return ev;
    }
    return {
        ...ev,
        end: normalizeShiftEventEndIso(ev.start, ev.end),
    };
}

/** Parse user id from `overlay-shift-{userId}-{shiftId}` (stable server id). */
function overlayUserIdFromShiftEventId(id: string | undefined): number | null {
    if (!id?.startsWith('overlay-shift-')) return null;
    const rest = id.slice('overlay-shift-'.length);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash < 1) return null;
    const uid = parseInt(rest.slice(0, lastDash), 10);
    return Number.isFinite(uid) ? uid : null;
}

function buildEventContent(selectedUserIds: number[]): (info: {
    event: {
        id: string;
        extendedProps?: CalendarEvent['extendedProps'] & {
            isTimeOff?: boolean;
            isLfwRange?: boolean;
        };
        title: string;
        start: string | Date;
        end: string | Date | null;
    };
}) => ReactNode {
    return (info) => {
        const ev = info.event;
        const p = ev.extendedProps;
        if (ev.id?.startsWith('timeoff-') || p?.isTimeOff) {
            const label = ev.title || 'Need off';
            return (
                <div className="flex min-w-0 items-center justify-center truncate rounded-lg bg-slate-200/80 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-600/30 dark:text-slate-300">
                    <span className="truncate font-medium">{label}</span>
                </div>
            );
        }
        if (ev.id?.startsWith('lfw-post-') || p?.isLfwPost) {
            const label = ev.title || 'LFW post';
            return (
                <div
                    className="flex min-w-0 items-center justify-center truncate rounded-lg border border-amber-600/50 bg-amber-200/90 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-400/50 dark:bg-amber-900/55 dark:text-amber-50"
                    title={p?.notes ? String(p.notes) : undefined}
                >
                    <span className="truncate">{label}</span>
                </div>
            );
        }
        if (
            (ev.id?.startsWith('lfw-') && !ev.id.startsWith('lfw-post-')) ||
            p?.isLfwRange
        ) {
            const label = ev.title || 'Looking for work';
            return (
                <div className="flex min-w-0 items-center justify-center truncate rounded-lg border border-dashed border-amber-500/45 bg-amber-100/85 px-2 py-0.5 text-xs text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/35 dark:text-amber-50">
                    <span className="truncate font-medium">{label}</span>
                </div>
            );
        }
        if (p?.isOverlayTimeOff && p.overlayUserId != null) {
            const pi = colorIndexForUserId(p.overlayUserId, selectedUserIds);
            const pal = OTHERS_BOARD_PALETTE[pi];
            const label = ev.title || 'Need off';
            return (
                <div
                    className={`flex min-w-0 flex-col items-center justify-center gap-0.5 truncate rounded-lg px-2 py-0.5 text-center text-xs ${pal.timeOff}`}
                >
                    <span className="truncate font-medium">{label}</span>
                    {p.overlayUserName ? (
                        <span className="truncate text-[10px] opacity-90">
                            {p.overlayUserName}
                        </span>
                    ) : null}
                </div>
            );
        }
        if (p?.isOverlayLfw && p.overlayUserId != null) {
            const pi = colorIndexForUserId(p.overlayUserId, selectedUserIds);
            const pal = OTHERS_BOARD_PALETTE[pi];
            const label = ev.title || 'Looking for work';
            return (
                <div
                    className={`flex min-w-0 flex-col items-center justify-center gap-0.5 truncate rounded-lg px-2 py-0.5 text-center text-xs ${pal.lfw}`}
                >
                    <span className="truncate font-medium">{label}</span>
                    {p.overlayUserName ? (
                        <span className="truncate text-[10px] opacity-90">
                            {p.overlayUserName}
                        </span>
                    ) : null}
                </div>
            );
        }
        if (p?.isOverlayLfwPost && p.overlayUserId != null) {
            const pi = colorIndexForUserId(p.overlayUserId, selectedUserIds);
            const pal = OTHERS_BOARD_PALETTE[pi];
            const label = ev.title || 'LFW post';
            return (
                <div
                    className={`flex min-w-0 flex-col items-center justify-center gap-0.5 truncate rounded-lg px-2 py-0.5 text-center text-xs ${pal.lfwPost}`}
                >
                    <span className="truncate font-medium">{label}</span>
                    {p.overlayUserName ? (
                        <span className="truncate text-[10px] opacity-90">
                            {p.overlayUserName}
                        </span>
                    ) : null}
                </div>
            );
        }
        const overlayShiftUid =
            p?.overlayUserId ?? overlayUserIdFromShiftEventId(ev.id);
        const isOverlayTimedShift =
            overlayShiftUid != null &&
            !p?.isOverlayTimeOff &&
            !p?.isOverlayLfw &&
            !p?.isOverlayLfwPost &&
            (p?.isOverlayOther === true ||
                (typeof ev.id === 'string' &&
                    ev.id.startsWith('overlay-shift-')));
        if (isOverlayTimedShift) {
            const desk =
                p?.position_name ??
                ((ev.title || '').replace(/\s*\[Post\]\s*$/, '').trim() ||
                    'Shift');
            const startIso =
                ev.start instanceof Date
                    ? ev.start.toISOString()
                    : String(ev.start ?? '');
            const endIso =
                ev.end == null
                    ? startIso
                    : ev.end instanceof Date
                      ? ev.end.toISOString()
                      : String(ev.end);
            const pi = colorIndexForUserId(overlayShiftUid, selectedUserIds);
            const pal = OTHERS_BOARD_PALETTE[pi];
            return (
                <ScheduleCalendarShiftEventContent
                    positionLabel={desk}
                    subtitle={p?.overlayUserName}
                    startIso={startIso}
                    endIso={endIso}
                    regulatory={p?.regulatory}
                    posts={p?.posts ?? []}
                    surfaceClassName={pal.shift}
                />
            );
        }
        const desk =
            p?.position_name ??
            ((ev.title || '').replace(/\s*\[Post\]\s*$/, '').trim() || 'Shift');
        const startIso =
            ev.start instanceof Date
                ? ev.start.toISOString()
                : String(ev.start ?? '');
        const endIso =
            ev.end == null
                ? startIso
                : ev.end instanceof Date
                  ? ev.end.toISOString()
                  : String(ev.end);
        return (
            <ScheduleCalendarShiftEventContent
                positionLabel={desk}
                startIso={startIso}
                endIso={endIso}
                regulatory={p?.regulatory}
                posts={p?.posts ?? []}
            />
        );
    };
}

export default function OthersBoardsPage() {
    const { auth } = usePage().props as {
        auth?: { user?: { name?: string } };
    };
    const myName = auth?.user?.name ?? 'You';

    const [eligibleUsers, setEligibleUsers] = useState<
        { id: number; name: string }[]
    >([]);
    const [eligibleError, setEligibleError] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [timeOffRanges, setTimeOffRanges] = useState<TimeOffRange[]>([]);
    const [lfwDateRanges, setLfwDateRanges] = useState<LfwDateRangeRow[]>([]);
    const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
    const [overlayEvents, setOverlayEvents] = useState<CalendarEvent[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);

    const fetchRangeRef = useRef<{ start: string; end: string } | null>(null);
    const selectedUserIdsRef = useRef(selectedUserIds);
    selectedUserIdsRef.current = selectedUserIds;

    const filteredEligible = useMemo(() => {
        const q = userFilter.trim().toLowerCase();
        if (!q) return eligibleUsers;
        return eligibleUsers.filter((u) => u.name.toLowerCase().includes(q));
    }, [eligibleUsers, userFilter]);

    const sortedSelectedIds = useMemo(
        () => [...selectedUserIds].sort((a, b) => a - b),
        [selectedUserIds],
    );

    useEffect(() => {
        let cancelled = false;
        fetch('/api/others-boards/users', {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                if (Array.isArray(data)) {
                    setEligibleUsers(
                        data.filter(
                            (u: unknown) =>
                                u &&
                                typeof u === 'object' &&
                                typeof (u as { id: unknown }).id === 'number' &&
                                typeof (u as { name: unknown }).name ===
                                    'string',
                        ),
                    );
                    setEligibleError(null);
                } else {
                    setEligibleUsers([]);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    logClientError('others-boards.eligibleUsers', e);
                    setEligibleError('Could not load coworkers list.');
                    setEligibleUsers([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        fetch('/api/time-off-ranges', {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (Array.isArray(data)) setTimeOffRanges(data);
            })
            .catch((e) => logClientError('others-boards.timeOff', e));
    }, []);

    useEffect(() => {
        fetch('/api/lfw-date-ranges', {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!Array.isArray(data)) return;
                const rows: LfwDateRangeRow[] = [];
                for (const item of data) {
                    if (
                        item &&
                        typeof item === 'object' &&
                        typeof (item as { id: unknown }).id === 'number' &&
                        typeof (item as { dateFrom: unknown }).dateFrom ===
                            'string' &&
                        typeof (item as { dateTo: unknown }).dateTo === 'string'
                    ) {
                        const o = item as {
                            id: number;
                            title?: string | null;
                            dateFrom: string;
                            dateTo: string;
                        };
                        rows.push({
                            id: o.id,
                            title: o.title ?? null,
                            dateFrom: o.dateFrom,
                            dateTo: o.dateTo,
                        });
                    }
                }
                setLfwDateRanges(rows);
            })
            .catch((e) => logClientError('others-boards.lfwRanges', e));
    }, []);

    const fetchOverlay = useCallback(async (start: string, end: string) => {
        const ids = selectedUserIdsRef.current;
        if (ids.length === 0) {
            setOverlayEvents([]);
            return;
        }
        const params = new URLSearchParams();
        params.set('start', start);
        params.set('end', end);
        // Comma-separated: reliable for GET across PHP/query parsers (bracket arrays can be dropped).
        params.set('user_ids', ids.join(','));
        try {
            const res = await fetch(
                `/api/others-boards/overlay?${params.toString()}`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'include',
                },
            );
            if (!res.ok) {
                const errBody = await res.json().catch(() => null);
                const msg =
                    errBody &&
                    typeof errBody === 'object' &&
                    'message' in errBody &&
                    typeof (errBody as { message: string }).message === 'string'
                        ? (errBody as { message: string }).message
                        : `Request failed (${res.status})`;
                throw new Error(msg);
            }
            const data = await res.json().catch(() => null);
            setOverlayEvents(
                data &&
                    typeof data === 'object' &&
                    Array.isArray((data as { events: unknown }).events)
                    ? (data as { events: CalendarEvent[] }).events
                    : [],
            );
        } catch (e) {
            logClientError('others-boards.overlay', e);
            setOverlayEvents([]);
        }
    }, []);

    const fetchMyEvents = useCallback(async (start: string, end: string) => {
        const params = new URLSearchParams();
        params.set('start', start);
        params.set('end', end);
        try {
            const res = await fetch(
                `/api/calendar/events?${params.toString()}`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'include',
                },
            );
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (Array.isArray(data)) setMyEvents(data);
        } catch (e) {
            logClientError('others-boards.myEvents', e);
        }
    }, []);

    const runRangeFetch = useCallback(
        async (fetchStartStr: string, fetchEndStr: string) => {
            setCalendarLoading(true);
            try {
                await Promise.all([
                    fetchMyEvents(fetchStartStr, fetchEndStr),
                    fetchOverlay(fetchStartStr, fetchEndStr),
                ]);
            } finally {
                setCalendarLoading(false);
            }
        },
        [fetchMyEvents, fetchOverlay],
    );

    const handleDatesSet = useCallback(
        (arg: { startStr: string; endStr: string }) => {
            const start = new Date(arg.startStr);
            const end = new Date(arg.endStr);
            const fetchStart = new Date(
                start.getFullYear(),
                start.getMonth() - 1,
                1,
            );
            const fetchEnd = new Date(
                end.getFullYear(),
                end.getMonth() + 2,
                0,
                23,
                59,
                59,
                999,
            );
            const fetchStartStr = fetchStart.toISOString();
            const fetchEndStr = fetchEnd.toISOString();
            fetchRangeRef.current = { start: fetchStartStr, end: fetchEndStr };
            void runRangeFetch(fetchStartStr, fetchEndStr);
        },
        [runRangeFetch],
    );

    useEffect(() => {
        const r = fetchRangeRef.current;
        if (!r) return;
        void fetchOverlay(r.start, r.end);
    }, [selectedUserIds, fetchOverlay]);

    const toggleUser = useCallback((id: number) => {
        setSelectedUserIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }, []);

    const eventContentFn = useMemo(
        () => buildEventContent(selectedUserIds),
        [selectedUserIds],
    );

    const calendarEvents = useMemo(
        () => [
            ...timeOffToCalendarEvents(timeOffRanges),
            ...lfwToCalendarEvents(lfwDateRanges),
            ...myEvents.map(normalizeEventEnd),
            ...overlayEvents.map((ev) =>
                ev.extendedProps?.isOverlayTimeOff ||
                ev.extendedProps?.isOverlayLfw ||
                ev.extendedProps?.isOverlayLfwPost
                    ? ev
                    : normalizeEventEnd(ev),
            ),
        ],
        [timeOffRanges, lfwDateRanges, myEvents, overlayEvents],
    );

    const showMyLfwPostLegend = useMemo(
        () => myEvents.some((e) => e.id?.startsWith('lfw-post-')),
        [myEvents],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Others' boards" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Users className="size-7 text-muted-foreground" />
                        Others&apos; boards
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Your schedule with optional overlays: coworkers who
                        share a workgroup with you can show their shifts,
                        need-off dates, LFW availability ranges, and open LFW
                        posts. Each person uses a consistent color.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
                    <div className="space-y-3 rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
                        <Label className="text-base font-medium">
                            Overlay coworkers
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Only people in at least one of your workgroups
                            appear here.
                        </p>
                        {eligibleError ? (
                            <p className="text-sm text-destructive">
                                {eligibleError}
                            </p>
                        ) : null}
                        <Input
                            placeholder="Search by name…"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="h-9"
                            disabled={
                                eligibleUsers.length === 0 && !eligibleError
                            }
                        />
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {filteredEligible.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {eligibleUsers.length === 0
                                        ? 'No coworkers found in your workgroups.'
                                        : 'No matches.'}
                                </p>
                            ) : (
                                filteredEligible.map((u) => (
                                    <label
                                        key={u.id}
                                        className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-1 py-1 hover:bg-muted/60"
                                    >
                                        <Checkbox
                                            checked={selectedUserIds.includes(
                                                u.id,
                                            )}
                                            onCheckedChange={() =>
                                                toggleUser(u.id)
                                            }
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">
                                            {u.name}
                                        </span>
                                        {selectedUserIds.includes(u.id) ? (
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                                                style={{
                                                    backgroundColor:
                                                        OTHERS_BOARD_LEGEND_HEX[
                                                            colorIndexForUserId(
                                                                u.id,
                                                                selectedUserIds,
                                                            ) %
                                                                OTHERS_BOARD_LEGEND_HEX.length
                                                        ],
                                                }}
                                                title="Color on calendar"
                                            />
                                        ) : null}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <div
                        className="schedule-calendar relative rounded-xl border border-sidebar-border/70 bg-card p-2 sm:p-4 dark:border-sidebar-border"
                        data-tour="others-boards-calendar"
                    >
                        {calendarLoading && (
                            <div
                                className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-[1px]"
                                aria-hidden="true"
                            >
                                <span className="text-sm text-muted-foreground">
                                    Loading…
                                </span>
                            </div>
                        )}
                        <FullCalendar
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            views={{
                                dayGridMonth: {
                                    showNonCurrentDates: true,
                                    fixedWeekCount: true,
                                },
                            }}
                            // Default `dayMaxEvents: true` + `height="auto"` hides extra timed
                            // events behind “+more”; all-day need-off still shows. Show everything.
                            dayMaxEvents={false}
                            expandRows
                            headerToolbar={{
                                left: 'title',
                                right: 'prev,next today',
                            }}
                            events={calendarEvents}
                            eventContent={eventContentFn}
                            eventClassNames={(arg) =>
                                arg.event.end &&
                                new Date(arg.event.end) < new Date()
                                    ? ['fc-event-past']
                                    : []
                            }
                            datesSet={handleDatesSet}
                            editable={false}
                            droppable={false}
                            height="auto"
                            contentHeight="auto"
                            aspectRatio={1.8}
                        />
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                                {myName}
                            </span>
                            <span>
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-sm bg-blue-400 align-middle" />{' '}
                                Your shifts
                            </span>
                            {timeOffRanges.length > 0 ? (
                                <span>
                                    <span
                                        className="mr-1 inline-block h-1.5 w-1.5 rounded-sm align-middle"
                                        style={{
                                            backgroundColor:
                                                'rgba(148, 163, 184, 0.5)',
                                        }}
                                    />{' '}
                                    Your need off
                                </span>
                            ) : null}
                            {lfwDateRanges.length > 0 ? (
                                <span>
                                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-sm border border-dashed border-amber-600/60 bg-amber-200/70 align-middle dark:border-amber-400/50 dark:bg-amber-900/50" />{' '}
                                    Your LFW ranges
                                </span>
                            ) : null}
                            {showMyLfwPostLegend ? (
                                <span>
                                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-sm border border-amber-600/60 bg-amber-300/80 align-middle dark:border-amber-400/55 dark:bg-amber-800/70" />{' '}
                                    Your LFW posts (open)
                                </span>
                            ) : null}
                            {sortedSelectedIds.map((uid) => {
                                const u = eligibleUsers.find(
                                    (x) => x.id === uid,
                                );
                                const pi = colorIndexForUserId(
                                    uid,
                                    selectedUserIds,
                                );
                                return (
                                    <span
                                        key={uid}
                                        className="inline-flex items-center gap-1"
                                    >
                                        <span
                                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    OTHERS_BOARD_LEGEND_HEX[
                                                        pi %
                                                            OTHERS_BOARD_LEGEND_HEX.length
                                                    ],
                                            }}
                                        />
                                        {u?.name ?? `User ${uid}`}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
