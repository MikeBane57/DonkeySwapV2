import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DollarSign, Handshake, Plane, Repeat } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const MOBILE_BREAKPOINT = 640;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Calendar', href: '/app/calendar' },
];

type CalendarEvent = {
    id: string;
    title: string;
    start: string;
    end: string;
    extendedProps?: {
        shiftId: number;
        regulatory?: boolean;
        postType?: string;
        postId?: number;
        cashAmount?: number;
        flightFollowMinutes?: number;
    };
};

/** Format time with AM/PM as subscript for calendar view. */
function timeWithSubscript(iso: string): ReactNode {
    const s = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const m = s.match(/^(.+?)\s+(AM|PM)$/i);
    if (!m) return s;
    return (
        <>
            {m[1]}{' '}
            <sub className="text-[0.65em] align-baseline opacity-90">{m[2]}</sub>
        </>
    );
}

/** Clamp overnight shifts to end of start day (in local time) so they only appear on the day the shift starts. */
function normalizeEventEnd(ev: CalendarEvent): CalendarEvent {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    if (startDateStr !== endDateStr) {
        const endOfStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
        return { ...ev, end: endOfStartDay.toISOString() };
    }
    return ev;
}

function eventContent(info: { event: { extendedProps: CalendarEvent['extendedProps'] & { posts?: { type: string }[] }; title: string } }) {
    const p = info.event.extendedProps;
    const posts = p?.posts ?? [];
    const badges = [];
    if (p?.regulatory) badges.push(<span key="r" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 mr-0.5" title="Regulatory" />);
    if (posts.some((x) => x.type === 'trade') || p?.postType === 'trade') badges.push(<Handshake key="t" className="size-3 shrink-0 text-blue-600 dark:text-blue-400" title="Trade" />);
    if (posts.some((x) => x.type === 'time_trade') || p?.postType === 'time_trade') badges.push(<Repeat key="tt" strokeWidth={2.5} className="size-3 shrink-0 text-blue-600 dark:text-blue-400" title="Time trade" />);
    if (posts.some((x) => x.type === 'cash') || p?.postType === 'cash') badges.push(<DollarSign key="c" className="size-3 shrink-0 text-green-600 dark:text-green-400" title="Giveaway" />);
    if (posts.some((x) => x.type === 'flight_follow') || p?.postType === 'flight_follow') badges.push(<Plane key="f" className="size-3 shrink-0 text-purple-600 dark:text-purple-400" title="Flight Follow" />);
    return (
        <div className="flex items-center gap-0.5 truncate">
            {badges}
            <span className="truncate">{info.event.title}</span>
        </div>
    );
}

export default function CalendarPage() {
    const { auth, initialEvents = [] } = usePage().props as {
        auth: { user: { time_display_preference?: string } };
        initialEvents?: CalendarEvent[];
    };
    const [events, setEvents] = useState<CalendarEvent[]>(initialEvents ?? []);
    const [modalDate, setModalDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(true);
    const calendarRef = useRef<FullCalendar>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        const api = calendarRef.current?.getApi?.();
        if (!api) return;
        if (isMobile && api.view?.type !== 'listWeek') api.changeView('listWeek');
        if (!isMobile && api.view?.type === 'listWeek') api.changeView('dayGridMonth');
    }, [isMobile]);

    const headerToolbar = useMemo(() => ({
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek',
    }), []);

    const fetchEvents = useCallback(async (start?: string, end?: string) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const res = await fetch(`/api/calendar/events?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            setEvents(Array.isArray(data) ? data : []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const t = setInterval(() => fetchEvents(), 30000);
        return () => clearInterval(t);
    }, [fetchEvents]);

    const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
        fetchEvents(arg.startStr, arg.endStr);
    }, [fetchEvents]);

    const handleDateClick = useCallback((arg: { dateStr: string }) => {
        setModalDate(arg.dateStr);
    }, []);

    const dayEvents = modalDate
        ? events.filter((e) => e.start.slice(0, 10) === modalDate)
        : [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar" />
            <div className="p-3 sm:p-4">
                <div className="schedule-calendar rounded-xl border border-sidebar-border/70 bg-card p-3 sm:p-4 dark:border-sidebar-border">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                        initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
                        headerToolbar={headerToolbar}
                        dayMaxEvents={isMobile ? 2 : 4}
                        events={events.map(normalizeEventEnd)}
                        eventContent={eventContent}
                        datesSet={handleDatesSet}
                        dateClick={handleDateClick}
                        editable={false}
                        droppable={false}
                        height="auto"
                    />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle mr-1" /> Regulatory</span>
                    <span className="text-blue-600">Trade</span>
                    <span className="text-blue-600">Time trade</span>
                    <span className="text-green-600">$ Cash</span>
                    <span className="text-purple-600">FF Flight follow</span>
                </div>
            </div>

            <Dialog open={!!modalDate} onOpenChange={(open) => !open && setModalDate(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Shifts for {modalDate}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">No shifts this day.</p>}
                        {dayEvents.map((ev) => (
                            <div key={ev.id} className="rounded border p-2 text-sm">
                                <div className="font-medium">{ev.title}</div>
                                <div className="text-muted-foreground text-xs">
                                    {timeWithSubscript(ev.start)} – {timeWithSubscript(ev.end)}
                                    {auth?.user?.time_display_preference === 'central_zulu' && (
                                        <span className="ml-1">({new Date(ev.start).toISOString().slice(11, 16)}Z – {new Date(ev.end).toISOString().slice(11, 16)}Z)</span>
                                    )}
                                </div>
                                {ev.extendedProps?.postType && (
                                    <div className="mt-1 text-xs">
                                        Post: {ev.extendedProps.postType}
                                        {ev.extendedProps.cashAmount != null && ` $${ev.extendedProps.cashAmount}`}
                                        {ev.extendedProps.flightFollowMinutes != null && ` ${ev.extendedProps.flightFollowMinutes} min FF`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
