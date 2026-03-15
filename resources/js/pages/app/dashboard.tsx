import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import {
    Download,
    Handshake,
    CalendarSync,
    Plane,
    Repeat,
    DollarSign,
    RefreshCw,
    Plus,
    ArrowLeftRight,
} from 'lucide-react';
import { CalendarOff, Trash2, AlertCircle, MessageSquare, Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState  } from 'react';
import type {ReactNode} from 'react';
import { AddShiftModal } from '@/components/add-shift-modal';
import { BulkPostModal } from '@/components/bulk-post-modal';
import { PostShiftModal  } from '@/components/post-shift-modal';
import type {ExistingPost} from '@/components/post-shift-modal';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard() },
];

const DESK_TYPE_LABELS: Record<string, string> = {
    domestic_dispatch: 'Domestic dispatch',
    assistant_desk: 'Assistant desk',
    etops: 'ETOPS',
    intl: 'INTL',
    regional: 'Regional (G)',
    sector: 'Sector (S)',
    nextday: 'NextDay (R)',
    extra: 'Extra',
};

function getDeskTypeLabel(
    workgroups: { id: number; desk_types?: { code: string; label: string }[] }[],
    workgroupId: number | null | undefined,
    code: string | null | undefined
): string {
    if (!code) return '';
    const wg = workgroupId != null ? workgroups.find((w) => w.id === workgroupId) : null;
    const label = wg?.desk_types?.find((d) => d.code === code)?.label;
    return label ?? DESK_TYPE_LABELS[code] ?? code;
}

/** Days from today (local) to shift start date (local). 0 = today, 1 = tomorrow, 2+ = in 2 days. */
function daysUntilShift(startTimeUtc: string): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const shift = new Date(startTimeUtc);
    const shiftDay = new Date(shift.getFullYear(), shift.getMonth(), shift.getDate());
    return Math.round((shiftDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

type ShiftSummary = {
    id: number;
    position_name: string;
    desk_type?: string | null;
    start_time_utc: string;
    end_time_utc: string;
    workgroup_name?: string;
};

type ActivePost = {
    id: number;
    type: string;
    cash_amount?: number;
    flight_follow_minutes?: number;
    notes?: string | null;
    shift_id: number;
    position_name?: string;
    desk_type?: string | null;
    workgroup_id?: number | null;
    workgroup_name?: string | null;
    preferred_start_times?: string[] | null;
    start_time_utc?: string;
    end_time_utc?: string;
    within_24h?: boolean;
};

/** Group active posts by shift and by kind: trade/cash = one card, flight_follow = separate card. */
type ActivePostGroup = {
    shiftId: number;
    position_name: string;
    desk_type?: string | null;
    workgroup_id?: number | null;
    workgroup_name?: string | null;
    start: string;
    end: string;
    within_24h: boolean;
    kind: 'trade_cash' | 'time_trade' | 'flight_follow';
    posts: ActivePost[];
};
function groupActivePosts(activePosts: ActivePost[]): ActivePostGroup[] {
    const byShift = new Map<number, ActivePost[]>();
    for (const p of activePosts) {
        const list = byShift.get(p.shift_id) ?? [];
        list.push(p);
        byShift.set(p.shift_id, list);
    }
    const result: ActivePostGroup[] = [];
    for (const [, shiftPosts] of byShift) {
        const tradeCash = shiftPosts.filter((p) => p.type === 'trade' || p.type === 'cash');
        const timeTrade = shiftPosts.filter((p) => p.type === 'time_trade');
        const ff = shiftPosts.filter((p) => p.type === 'flight_follow');
        const first = shiftPosts[0];
        const start = first?.start_time_utc ?? '';
        const end = first?.end_time_utc ?? '';
        const within_24h = first?.within_24h ?? false;
        if (tradeCash.length > 0) {
            result.push({
                shiftId: first!.shift_id,
                position_name: first!.position_name ?? '',
                desk_type: first!.desk_type,
                workgroup_id: first!.workgroup_id ?? null,
                workgroup_name: first!.workgroup_name,
                start,
                end,
                within_24h,
                kind: 'trade_cash',
                posts: tradeCash,
            });
        }
        if (timeTrade.length > 0) {
            result.push({
                shiftId: first!.shift_id,
                position_name: first!.position_name ?? '',
                desk_type: first!.desk_type,
                workgroup_id: first!.workgroup_id ?? null,
                workgroup_name: first!.workgroup_name,
                start,
                end,
                within_24h,
                kind: 'time_trade',
                posts: timeTrade,
            });
        }
        if (ff.length > 0) {
            result.push({
                shiftId: first!.shift_id,
                position_name: first!.position_name ?? '',
                desk_type: first!.desk_type,
                workgroup_id: first!.workgroup_id ?? null,
                workgroup_name: first!.workgroup_name,
                start,
                end,
                within_24h,
                kind: 'flight_follow',
                posts: ff,
            });
        }
    }
    return result.sort((a, b) => a.start.localeCompare(b.start));
}

type OfferedShiftOption = {
    id: number;
    position_name: string;
    start_time_utc: string;
    end_time_utc?: string;
};

type ActionRequiredItem = {
    id: number;
    swap_post_id: number;
    shift_id?: number | null;
    post_type: string;
    position_name?: string;
    start_time_utc?: string;
    end_time_utc?: string;
    offered_by_name?: string;
    offered_by_contact?: string | null;
    offered_by_contact_method?: string | null;
    response_notes?: string | null;
    offered_shift_summary?: string | null;
    offered_shifts?: OfferedShiftOption[];
    cash_amount?: number | null;
};

type CalendarEvent = {
    id: string;
    title: string;
    start: string;
    end: string;
    extendedProps?: {
        shiftId: number;
        position_name?: string;
        desk_type?: string | null;
        regulatory?: boolean;
        posts?: { id: number; type: string; cash_amount?: number | null; flight_follow_minutes?: number | null; flight_follow_at?: string | null; notes?: string | null; preferred_start_times?: string[] | null }[];
        workgroup_id?: number | null;
        workgroup_name?: string;
        /** True when this is a shift the user would receive from a pending offer (not yet committed). */
        pending_incoming?: boolean;
        /** Poster has a pending offer to respond to on this shift. */
        action_required?: boolean;
        action_required_offer_id?: number | null;
        /** Shift was received via accepted offer; show as new until user dismisses notification. */
        is_new_shift?: boolean;
        new_shift_notification_id?: number | null;
    };
};

type MonthStats = {
    month_label: string;
    shifts_count: number;
    days_off_count: number;
    action_required_count: number;
};

type BannerMessage = {
    id: number;
    title: string;
    body: string;
    created_at: string | null;
};

type TimeOffRange = {
    id: number;
    title?: string | null;
    start_date: string;
    end_date: string;
    notes?: string | null;
};

const DASHBOARD_RELOAD_ONLY = ['activePosts', 'actionRequired', 'currentShift', 'nextShift', 'upcomingShifts', 'monthStats', 'timeOffRanges', 'initialEvents'] as const;

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function postTypeLabel(type: string | undefined): string {
    if (!type) return 'post';
    switch (type) {
        case 'cash': return 'cash giveaway';
        case 'trade': return 'trade';
        case 'time_trade': return 'time trade';
        case 'flight_follow': return 'flight following';
        default: return type.replace('_', ' ');
    }
}

function formatRangeShort(startDate: string, endDate: string): string {
    try {
        const s = new Date(startDate + 'T12:00:00');
        const e = new Date(endDate + 'T12:00:00');
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(s)} – ${fmt(e)}`;
    } catch {
        return `${startDate} – ${endDate}`;
    }
}

function formatCentral(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

/** Short date for active posts: e.g. "3/14" for March 14. */
function formatShortDate(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
        return iso.slice(0, 10);
    }
}

function formatTime(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatStartTimeOnly(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

/** Full 24h clock for calendar (e.g. 1400, 0600, 1430). */
function formatStartTime24Full(iso: string): string {
    try {
        const d = new Date(iso);
        const s = d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour12: false, hour: '2-digit', minute: '2-digit' });
        return s.replace(':', '');
    } catch {
        return '';
    }
}

/** Render time string (e.g. "6:00 AM") with AM/PM as subscript for calendar view. */
function timeWithSubscript(formatted: string): ReactNode {
    const m = formatted.match(/^(.+?)\s+(AM|PM)$/i);
    if (!m) return formatted;
    return (
        <>
            {m[1]}{' '}
            <sub className="text-[0.65em] align-baseline opacity-90">{m[2]}</sub>
        </>
    );
}

function isDateInTimeOffRanges(dateStr: string, ranges: TimeOffRange[]): boolean {
    if (!ranges.length) return false;
    for (const r of ranges) {
        if (dateStr >= r.start_date && dateStr <= r.end_date) return true;
    }
    return false;
}

function getTimeOffRangeTitleForDate(dateStr: string, ranges: TimeOffRange[]): string | null {
    for (const r of ranges) {
        if (dateStr >= r.start_date && dateStr <= r.end_date) return r.title ?? 'Need off';
    }
    return null;
}

/** Count consecutive days with no shift before and after the given date. */
function getDaysOffBeforeAfter(dateStr: string, shiftDates: Set<string>, maxDays = 31): { daysOffBefore: number; daysOffAfter: number } {
    let daysOffBefore = 0;
    let daysOffAfter = 0;
    for (let i = 1; i <= maxDays; i++) {
        const dBefore = new Date(dateStr + 'T12:00:00');
        dBefore.setDate(dBefore.getDate() - i);
        const beforeStr = dBefore.toISOString().slice(0, 10);
        if (!shiftDates.has(beforeStr)) daysOffBefore++;
        else break;
    }
    for (let i = 1; i <= maxDays; i++) {
        const dAfter = new Date(dateStr + 'T12:00:00');
        dAfter.setDate(dAfter.getDate() + i);
        const afterStr = dAfter.toISOString().slice(0, 10);
        if (!shiftDates.has(afterStr)) daysOffAfter++;
        else break;
    }
    return { daysOffBefore, daysOffAfter };
}

/** Convert time-off ranges to one all-day bar per range. Title shown once, centered on the event. */
function timeOffToCalendarEvents(ranges: TimeOffRange[]): Array<{ id: string; start: string; end: string; title: string; allDay: boolean; backgroundColor: string; extendedProps?: { isTimeOff: true } }> {
    return ranges.map((r) => {
        const end = new Date(r.end_date + 'T12:00:00');
        const title = (r.title?.trim() || r.notes?.trim() || 'Need off');
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

function eventContent(info: { event: { id: string; extendedProps?: CalendarEvent['extendedProps'] & { isTimeOff?: boolean }; title: string; start: string; end: string } }) {
    const ev = info.event;
    const p = ev.extendedProps;
    if (ev.id?.startsWith('timeoff-') || p?.isTimeOff) {
        const label = ev.title || 'Need off';
        return (
            <div className="flex min-w-0 items-center justify-center truncate rounded-lg px-2 py-0.5 text-xs bg-slate-200/80 text-slate-700 dark:bg-slate-600/30 dark:text-slate-300">
                <span className="truncate font-medium">{label}</span>
            </div>
        );
    }
    const desk = p?.position_name ?? ((ev.title || '').replace(/\s*\[Post\]\s*$/, '').trim() || 'Shift');
    const time24Full = formatStartTime24Full(ev.start);
    const isPast = new Date(ev.end) < new Date();
    const badges = [];
    if (p?.regulatory) badges.push(<span key="r" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Regulatory" />);
    const posts = p?.posts ?? [];
    if (posts.some((x) => x.type === 'trade')) badges.push(<Handshake key="t" className="size-3 shrink-0 text-blue-600 dark:text-blue-400" title="Trade" />);
    if (posts.some((x) => x.type === 'time_trade')) badges.push(<Repeat key="tt" strokeWidth={2.5} className="size-3 shrink-0 text-blue-600 dark:text-blue-400" title="Time trade" />);
    if (posts.some((x) => x.type === 'cash')) badges.push(<DollarSign key="c" className="size-3 shrink-0 text-green-600 dark:text-green-400" title="Giveaway" />);
    if (posts.some((x) => x.type === 'flight_follow')) badges.push(<Plane key="f" className="size-3 shrink-0 text-purple-600 dark:text-purple-400" title="Flight Follow" />);
    const isPendingIncoming = p?.pending_incoming;
    const isNewShift = p?.is_new_shift;
    if (p?.action_required) badges.push(<span key="action" className="shrink-0 rounded bg-amber-500/90 px-1 text-[10px] font-medium text-white dark:bg-amber-600 dark:text-amber-100" title="Action required — respond to offer">Action</span>);
    if (isNewShift) badges.push(<span key="new" className="shrink-0 rounded bg-green-600 px-1 text-[10px] font-medium text-white dark:bg-green-500 dark:text-green-950" title="New shift — your response was accepted. Please check workzone to ensure the change has been made properly.">New</span>);
    return (
        <div
            className={`flex w-full min-w-0 overflow-hidden rounded-lg px-2 py-0.5 text-xs ${
                isPendingIncoming
                    ? 'border border-dashed border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
                    : isPast
                    ? 'bg-muted text-muted-foreground opacity-70'
                    : 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
            } min-h-[3.5rem] flex-col items-center gap-0.5 py-1.5 sm:min-h-0 sm:flex-row sm:items-center sm:py-0.5`}
            title={`${desk} ${formatStartTimeOnly(ev.start)}`}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 truncate text-center sm:text-left">
                {/* Position on first line */}
                <span className="truncate font-medium">{desk}</span>
                {/* Start time in full 24h (1400, 0600, etc.) on second line */}
                {time24Full ? <span className="text-[10px] opacity-90">{time24Full}</span> : null}
            </div>
            <div className="flex shrink-0 items-center justify-center gap-0.5 sm:ml-auto sm:justify-end">
                {isPendingIncoming && <span className="rounded bg-amber-200/80 px-1 text-[10px] font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-100" title="Pending — waiting for response">Pending</span>}
                {badges.length > 0 && <span className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">{badges}</span>}
            </div>
        </div>
    );
}

export default function AppDashboard() {
    const props = usePage().props as unknown as {
        currentShift?: ShiftSummary | null;
        nextShift?: ShiftSummary | null;
        upcomingShifts?: ShiftSummary[];
        activePosts?: ActivePost[];
        actionRequired?: ActionRequiredItem[];
        initialEvents?: CalendarEvent[];
        monthStats?: MonthStats;
        timeOffRanges?: TimeOffRange[];
        userWorkgroups?: { id: number; name: string; allowed_start_times?: { start_time: string; default_duration_minutes: number }[]; desk_types?: { code: string; label: string }[] }[];
        userIsDispatch?: boolean;
        defaultWorkgroupId?: number | null;
        bannerMessages?: BannerMessage[];
        auth?: { user?: { time_display_preference?: string } };
    };
    const currentShift = props.currentShift ?? null;
    const nextShift = props.nextShift ?? null;
    const upcomingShifts = props.upcomingShifts ?? [];
    const activePosts = props.activePosts ?? [];
    const actionRequired = props.actionRequired ?? [];
    const monthStats = props.monthStats ?? { month_label: '', shifts_count: 0, days_off_count: 0, action_required_count: 0 };
    const auth = props.auth;
    const [events, setEvents] = useState<CalendarEvent[]>(props.initialEvents ?? []);

    // When server sends fresh initialEvents (e.g. after accepting a swap), sync to calendar so shifts reflect correctly
    useEffect(() => {
        if (Array.isArray(props.initialEvents)) {
            setEvents(props.initialEvents);
        }
    }, [props.initialEvents]);
    useEffect(() => {
        if (Array.isArray(props.bannerMessages)) {
            setBannerMessages(props.bannerMessages);
        }
    }, [props.bannerMessages]);
    const [timeOffRanges, setTimeOffRanges] = useState<TimeOffRange[]>(props.timeOffRanges ?? []);
    const [selectedRangeId, setSelectedRangeId] = useState<number | null>(null);
    const [newRangeTitle, setNewRangeTitle] = useState('');
    const [newRangeStart, setNewRangeStart] = useState('');
    const [newRangeEnd, setNewRangeEnd] = useState('');
    const [addingRange, setAddingRange] = useState(false);
    const [bulkPostShiftIds, setBulkPostShiftIds] = useState<number[] | null>(null);
    const [eventsInSelectedRange, setEventsInSelectedRange] = useState<CalendarEvent[]>([]);
    const [deletingPostShiftId, setDeletingPostShiftId] = useState<number | null>(null);
    const [activePostTypeFilter, setActivePostTypeFilter] = useState<string>('');
    const [activePostSearch, setActivePostSearch] = useState('');
    const userWorkgroups = props.userWorkgroups ?? [];
    const userIsDispatch = props.userIsDispatch ?? false;
    const defaultWorkgroupId = props.defaultWorkgroupId ?? null;
    const [bannerMessages, setBannerMessages] = useState<BannerMessage[]>(props.bannerMessages ?? []);
    const [showAddShiftModal, setShowAddShiftModal] = useState(false);
    const [modalDate, setModalDate] = useState<string | null>(null);
    const [eligiblePostCounts, setEligiblePostCounts] = useState<{ flight_follow: number; time_trade: number; trade: number; cash: number } | null>(null);
    const [datesWithEligibleGiveaway, setDatesWithEligibleGiveaway] = useState<string[]>([]);
    const [datesWithEligibleFF, setDatesWithEligibleFF] = useState<string[]>([]);
    const [postModalShift, setPostModalShift] = useState<{
        shiftId: number;
        position_name: string;
        desk_type?: string | null;
        start: string;
        end: string;
        workgroup_id?: number | null;
        workgroup_name?: string;
        posts: ExistingPost[];
        preselectFlightFollow?: boolean;
    } | null>(null);
    const [reviewOfferItem, setReviewOfferItem] = useState<ActionRequiredItem | null>(null);
    /** For trade/time_trade: which of the offered shifts the poster selected to accept. */
    const [reviewSelectedShiftId, setReviewSelectedShiftId] = useState<number | null>(null);
    /** When true, hide offered shifts that fall on days the poster needs off. */
    const [reviewHideNeedOff, setReviewHideNeedOff] = useState(false);
    const [offerResponding, setOfferResponding] = useState<'accept' | 'reject' | null>(null);
    const [offerRespondError, setOfferRespondError] = useState<string | null>(null);
    const calendarRef = useRef<{ getApi: () => { gotoDate: (d: Date) => void } }>(null);
    const [jumpToMonthOpen, setJumpToMonthOpen] = useState(false);
    const [jumpToMonthAnchor, setJumpToMonthAnchor] = useState({ x: 0, y: 0 });
    const jumpToMonthPopoverRef = useRef<HTMLDivElement>(null);
    const [jumpToMonth, setJumpToMonth] = useState(() => {
        const d = new Date();
        return { month: d.getMonth(), year: d.getFullYear() };
    });

    const fetchEvents = useCallback(async (start?: string, end?: string) => {
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
    }, []);

    useEffect(() => {
        const t = setInterval(() => fetchEvents(), 30000);
        return () => clearInterval(t);
    }, [fetchEvents]);

    useEffect(() => {
        const t = setInterval(() => {
            router.reload({ only: ['actionRequired', 'monthStats'] });
        }, 45000);
        return () => clearInterval(t);
    }, []);

    const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
        fetchEvents(arg.startStr, arg.endStr);
        const from = arg.startStr.slice(0, 10);
        const to = arg.endStr.slice(0, 10);
        const tz = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
        const tzParam = tz ? `&timezone=${encodeURIComponent(tz)}` : '';
        fetch(`/api/available/dates-with-eligible-giveaway?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}${tzParam}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && Array.isArray(data.dates)) {
                    setDatesWithEligibleGiveaway(data.dates);
                } else {
                    setDatesWithEligibleGiveaway([]);
                }
                if (data && Array.isArray(data.dates_ff)) {
                    setDatesWithEligibleFF(data.dates_ff);
                } else {
                    setDatesWithEligibleFF([]);
                }
            })
            .catch(() => {
                setDatesWithEligibleGiveaway([]);
                setDatesWithEligibleFF([]);
            });
    }, [fetchEvents]);

    const handleDateClick = useCallback((arg: { dateStr: string }) => {
        setModalDate(arg.dateStr);
    }, []);

    useEffect(() => {
        if (!modalDate || modalDate < new Date().toISOString().slice(0, 10)) {
            setEligiblePostCounts(null);
            return;
        }
        let cancelled = false;
        setEligiblePostCounts(null);
        fetch(`/api/available/eligible-counts?date=${encodeURIComponent(modalDate)}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (!cancelled && data && typeof data.flight_follow === 'number' && typeof data.time_trade === 'number' && typeof data.trade === 'number' && typeof data.cash === 'number') {
                    setEligiblePostCounts(data);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [modalDate]);

    const handleEventClick = useCallback((arg: { event: { id: string; extendedProps?: CalendarEvent['extendedProps']; title: string; startStr: string; endStr: string; end?: string } }) => {
        if (arg.event.id?.startsWith('timeoff-')) return;
        if (arg.event.id?.startsWith('pending-incoming-')) return; // Tentative shift from pending offer; not editable
        const ext = arg.event.extendedProps;
        const offerId = ext?.action_required_offer_id;
        if (offerId != null) {
            const item = actionRequired.find((a) => a.id === offerId);
            if (item) {
                setReviewOfferItem(item);
                return;
            }
        }
        // Open the day popup for this event's date (day is the primary click target)
        const dateStr = (arg.event.startStr ?? '').slice(0, 10);
        if (dateStr) setModalDate(dateStr);
    }, [actionRequired]);

    const handlePostSuccess = useCallback(() => {
        fetchEvents();
        router.reload({ only: DASHBOARD_RELOAD_ONLY });
    }, [fetchEvents]);

    const handleRefresh = useCallback(() => {
        fetchEvents();
        router.reload({ only: DASHBOARD_RELOAD_ONLY });
    }, [fetchEvents]);

    useEffect(() => {
        if (reviewOfferItem?.offered_shifts?.length) {
            setReviewSelectedShiftId(reviewOfferItem.offered_shifts[0].id);
        } else {
            setReviewSelectedShiftId(null);
        }
    }, [reviewOfferItem?.id, reviewOfferItem?.offered_shifts]);

    const visibleOfferedShifts = useMemo(() => {
        const offered = reviewOfferItem?.offered_shifts ?? [];
        if (!reviewHideNeedOff || timeOffRanges.length === 0) return offered;
        return offered.filter(
            (s) => !isDateInTimeOffRanges(s.start_time_utc?.slice(0, 10) ?? '', timeOffRanges)
        );
    }, [reviewOfferItem?.offered_shifts, reviewHideNeedOff, timeOffRanges]);

    useEffect(() => {
        if (reviewHideNeedOff && visibleOfferedShifts.length > 0 && reviewSelectedShiftId != null) {
            const isVisible = visibleOfferedShifts.some((s) => s.id === reviewSelectedShiftId);
            if (!isVisible) {
                setReviewSelectedShiftId(visibleOfferedShifts[0].id);
            }
        }
    }, [reviewHideNeedOff, visibleOfferedShifts, reviewSelectedShiftId]);

    const handleRespondToOffer = useCallback(async (offerId: number, action: 'accept' | 'reject', selectedShiftId?: number | null) => {
        setOfferRespondError(null);
        setOfferResponding(action);
        try {
            const body = action === 'accept' && selectedShiftId != null ? { selected_shift_id: selectedShiftId } : {};
            const res = await fetch(`/api/offers/${offerId}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                setReviewOfferItem(null);
                fetchEvents();
                router.reload({ only: DASHBOARD_RELOAD_ONLY });
            } else {
                setOfferRespondError(data.message ?? (res.status === 422 ? (data.errors?.[0] ?? 'Request failed') : `Request failed (${res.status}). Try again.`));
            }
        } catch {
            setOfferRespondError('Network error. Try again.');
        } finally {
            setOfferResponding(null);
        }
    }, [fetchEvents]);

    const [deletingPostGroup, setDeletingPostGroup] = useState<string | null>(null);
    const deleteActivePostGroup = useCallback(async (group: ActivePostGroup) => {
        const key = `${group.shiftId}-${group.kind}`;
        setDeletingPostGroup(key);
        try {
            const res = await fetch(`/api/shifts/${group.shiftId}/postings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': (() => {
                        const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
                        return m ? decodeURIComponent(m[1]) : '';
                    })(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ postings: [], delete_ids: group.posts.map((p) => p.id) }),
            });
            if (res.ok) {
                handlePostSuccess();
            }
        } finally {
            setDeletingPostGroup((k) => (k === key ? null : k));
        }
    }, [handlePostSuccess]);

    const [dismissingNotificationId, setDismissingNotificationId] = useState<number | null>(null);
    const dismissNewShiftNotification = useCallback(async (notificationId: number) => {
        setDismissingNotificationId(notificationId);
        try {
            const res = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
            if (res.ok) {
                fetchEvents();
                router.reload({ only: DASHBOARD_RELOAD_ONLY });
            }
        } finally {
            setDismissingNotificationId((id) => (id === notificationId ? null : id));
        }
    }, [fetchEvents]);

    const selectedRange = selectedRangeId ? timeOffRanges.find((r) => r.id === selectedRangeId) : null;

    useEffect(() => {
        if (!jumpToMonthOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (jumpToMonthPopoverRef.current?.contains(e.target as Node)) return;
            setJumpToMonthOpen(false);
        };
        const t = setTimeout(() => window.addEventListener('pointerdown', onPointerDown), 0);
        return () => {
            clearTimeout(t);
            window.removeEventListener('pointerdown', onPointerDown);
        };
    }, [jumpToMonthOpen]);

    useEffect(() => {
        if (!selectedRange) {
            setEventsInSelectedRange([]);
            return;
        }
        let cancelled = false;
        const params = new URLSearchParams({ start: selectedRange.start_date, end: selectedRange.end_date });
        fetch(`/api/calendar/events?${params}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        })
            .then((res) => res.ok ? res.json() : [])
            .then((data) => { if (!cancelled) setEventsInSelectedRange(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setEventsInSelectedRange([]); });
        return () => { cancelled = true; };
    }, [selectedRange?.id, selectedRange?.start_date, selectedRange?.end_date]);

    const now = new Date();
    const shiftsInSelectedRange = eventsInSelectedRange.filter((e) => new Date(e.end) >= now && !e.extendedProps?.pending_incoming);
    const shiftIdsInRange = shiftsInSelectedRange
        .map((e) => e.extendedProps?.shiftId)
        .filter((id): id is number => id != null);

    function countShiftsInRange(r: TimeOffRange): number {
        if (r.id === selectedRangeId) return shiftsInSelectedRange.length;
        return events.filter(
            (ev) =>
                !ev.extendedProps?.pending_incoming &&
                new Date(ev.end) >= now &&
                ev.start.slice(0, 10) <= r.end_date &&
                ev.end.slice(0, 10) >= r.start_date
        ).length;
    }

    const addTimeOffRange = useCallback(async () => {
        if (!newRangeStart || !newRangeEnd) return;
        setAddingRange(true);
        try {
            const res = await fetch('/api/time-off-ranges', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({ title: newRangeTitle.trim() || undefined, start_date: newRangeStart, end_date: newRangeEnd }),
            });
            if (res.ok) {
                const data = await res.json();
                setTimeOffRanges((prev) => [...prev, data]);
                setNewRangeTitle('');
                setNewRangeStart('');
                setNewRangeEnd('');
                setSelectedRangeId(data.id);
            }
        } finally {
            setAddingRange(false);
        }
    }, [newRangeTitle, newRangeStart, newRangeEnd]);

    const removePostForShift = useCallback(async (shiftId: number, postIds: number[], rangeStart: string, rangeEnd: string) => {
        if (postIds.length === 0) return;
        setDeletingPostShiftId(shiftId);
        try {
            const res = await fetch(`/api/shifts/${shiftId}/postings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ postings: [], delete_ids: postIds }),
            });
            if (res.ok) {
                handlePostSuccess();
                const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
                fetch(`/api/calendar/events?${params}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'include',
                })
                    .then((r) => (r.ok ? r.json() : []))
                    .then((data) => setEventsInSelectedRange(Array.isArray(data) ? data : []))
                    .catch(() => {});
            }
        } finally {
            setDeletingPostShiftId(null);
        }
    }, [handlePostSuccess]);

    const removeTimeOffRange = useCallback(async (id: number) => {
        try {
            const res = await fetch(`/api/time-off-ranges/${id}`, {
                method: 'DELETE',
                headers: { 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            if (res.ok) {
                setTimeOffRanges((prev) => prev.filter((r) => r.id !== id));
                if (selectedRangeId === id) setSelectedRangeId(null);
            }
        } catch {
            // ignore
        }
    }, [selectedRangeId]);

    const modalDateOnly = modalDate ? modalDate.slice(0, 10) : null;
    const dayEvents = modalDateOnly
        ? events.filter((e) => {
              const start = typeof e.start === 'string' ? e.start : (e.start as Date)?.toISOString?.();
              if (!start) return false;
              const d = new Date(start);
              const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return localDateStr === modalDateOnly;
          })
        : [];

    const displayNextShift = nextShift ?? (currentShift ? upcomingShifts[0] : null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Schedule" />
            <div className="flex flex-1 flex-col gap-5 overflow-x-hidden p-4 sm:gap-6">
                {/* Admin banner messages — must be acknowledged to clear */}
                {bannerMessages.length > 0 && (
                    <div className="space-y-3">
                        {bannerMessages.map((banner) => (
                            <div
                                key={banner.id}
                                className="flex gap-3 rounded-xl border border-amber-500/50 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30"
                            >
                                <MessageSquare className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">{banner.title}</h3>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-200">{banner.body}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 border-amber-600/50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`/api/banner-messages/${banner.id}/acknowledge`, {
                                                method: 'POST',
                                                headers: {
                                                    'Accept': 'application/json',
                                                    'Content-Type': 'application/json',
                                                    'X-Requested-With': 'XMLHttpRequest',
                                                    'X-XSRF-TOKEN': getCsrfToken(),
                                                },
                                                credentials: 'include',
                                            });
                                            if (res.ok) {
                                                setBannerMessages((prev) => prev.filter((m) => m.id !== banner.id));
                                            }
                                        } catch {
                                            // ignore
                                        }
                                    }}
                                >
                                    <Check className="size-4 mr-1" />
                                    Acknowledge
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Page header */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            My Schedule
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Manage your shifts and availability.
                        </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
                        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
                            <RefreshCw className="size-4" />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Download className="size-4" />
                            Import
                        </Button>
                        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddShiftModal(true)}>
                            <Plus className="size-4" />
                            Add Shift
                        </Button>
                    </div>
                </div>

                {/* Current shift — prominent when active */}
                {currentShift && (
                    <section className="rounded-xl border border-green-600/50 bg-green-500/10 p-4 dark:border-green-500/50 dark:bg-green-500/10">
                        <h2 className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">
                            Now
                        </h2>
                        <p className="mt-1 font-semibold">{currentShift.position_name}</p>
                        <p className="text-sm text-muted-foreground">
                            {formatTime(currentShift.start_time_utc)} – {formatTime(currentShift.end_time_utc)}
                            {currentShift.workgroup_name && ` · ${currentShift.workgroup_name}`}
                        </p>
                    </section>
                )}

                {/* Two columns: Next shift | Month stats */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Next upcoming shift */}
                    <section className="min-w-0 rounded-xl border border-sidebar-border/50 bg-gradient-to-br from-teal-50 to-emerald-50/80 p-3 shadow-sm dark:from-teal-950/30 dark:to-emerald-950/20">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next shift</h3>
                        {displayNextShift ? (
                            <>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <CalendarSync className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-foreground">{displayNextShift.position_name}</span>
                                        <span className="ml-1.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                            Upcoming
                                        </span>
                                    </div>
                                </div>
                                {displayNextShift.desk_type && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {getDeskTypeLabel(userWorkgroups, (displayNextShift as { workgroup_id?: number | null }).workgroup_id ?? null, displayNextShift.desk_type)}
                                    </p>
                                )}
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {formatCentral(displayNextShift.start_time_utc).split(',')[0]}
                                    <br />
                                    {formatTime(displayNextShift.start_time_utc)} – {formatTime(displayNextShift.end_time_utc)}
                                </p>
                                {(() => {
                                    const days = daysUntilShift(displayNextShift.start_time_utc);
                                    return days >= 2 ? (
                                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                                            {days} days until shift
                                        </p>
                                    ) : null;
                                })()}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                        onClick={() =>
                                            setPostModalShift({
                                                shiftId: displayNextShift.id,
                                                position_name: displayNextShift.position_name,
                                                desk_type: displayNextShift.desk_type ?? null,
                                                start: displayNextShift.start_time_utc,
                                                end: displayNextShift.end_time_utc,
                                                workgroup_id: (displayNextShift as { workgroup_id?: number | null }).workgroup_id ?? null,
                                                workgroup_name: displayNextShift.workgroup_name,
                                                posts: [],
                                            })
                                        }
                                    >
                                        <ArrowLeftRight className="size-3.5 mr-1" />
                                        Post
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950/30"
                                        onClick={() =>
                                            setPostModalShift({
                                                shiftId: displayNextShift.id,
                                                position_name: displayNextShift.position_name,
                                                desk_type: displayNextShift.desk_type ?? null,
                                                start: displayNextShift.start_time_utc,
                                                end: displayNextShift.end_time_utc,
                                                workgroup_id: (displayNextShift as { workgroup_id?: number | null }).workgroup_id ?? null,
                                                workgroup_name: displayNextShift.workgroup_name,
                                                posts: [],
                                                preselectFlightFollow: true,
                                            })
                                        }
                                    >
                                        <Plane className="size-3.5 mr-1" />
                                        Find FF
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <p className="mt-2 text-sm text-muted-foreground">No upcoming shift</p>
                        )}
                    </section>

                    {/* Middle: Month stats */}
                    <section className="min-w-0 rounded-xl border border-sidebar-border/50 bg-card p-3 shadow-sm">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">This month</h3>
                        <p className="mt-1 font-semibold text-foreground">{monthStats.month_label}</p>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Shifts</span>
                                <span className="font-medium">{monthStats.shifts_count}</span>
                            </li>
                            <li className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">24h periods off</span>
                                <span className="font-medium">{monthStats.days_off_count}</span>
                            </li>
                            <li className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Action required</span>
                                <span className={monthStats.action_required_count > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : 'font-medium'}>
                                    {monthStats.action_required_count > 0 ? (
                                        <span className="flex items-center gap-1">
                                            <AlertCircle className="size-4" />
                                            {monthStats.action_required_count}
                                        </span>
                                    ) : (
                                        '0'
                                    )}
                                </span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Action required — only when someone has responded to your post */}
                {actionRequired.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-muted-foreground">Action required</h2>
                        <ul className="space-y-2">
                            {actionRequired.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
                                >
                                    <div>
                                        <p className="font-medium">
                                            Someone responded to your {postTypeLabel(item.post_type)}
                                            {item.position_name && ` · ${item.position_name}`}
                                        </p>
                                        {item.start_time_utc && (
                                            <p className="text-sm text-muted-foreground">
                                                {formatCentral(item.start_time_utc)}
                                            </p>
                                        )}
                                        {item.offered_shift_summary && (item.post_type === 'trade' || item.post_type === 'time_trade') && (
                                            <p className="text-xs text-muted-foreground">
                                                Offered: {item.offered_shift_summary}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setReviewOfferItem(item)}
                                    >
                                        Review
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Dates I need off + Active posts — stack on small, side by side on large */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 min-w-0">
                <section className="rounded-xl border border-sidebar-border/50 bg-card p-3 shadow-sm min-w-0">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CalendarOff className="size-3.5" />
                        Dates I need off
                    </h3>
                        <div className="mt-2 space-y-2">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px]">Title</Label>
                                <Input
                                    type="text"
                                    placeholder="e.g. Vacation, Wedding"
                                    value={newRangeTitle}
                                    onChange={(e) => setNewRangeTitle(e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[10px]">Start</Label>
                                    <Input
                                        type="date"
                                        value={newRangeStart}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setNewRangeStart(v);
                                            setNewRangeEnd((prev) => (!prev || v > prev ? v : prev));
                                        }}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[10px]">End</Label>
                                    <Input
                                        type="date"
                                        value={newRangeEnd}
                                        onChange={(e) => setNewRangeEnd(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button size="sm" className="h-8" onClick={addTimeOffRange} disabled={addingRange || !newRangeStart || !newRangeEnd}>
                                        {addingRange ? '…' : 'Add'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {timeOffRanges.length > 0 && (
                            <div className="mt-3 max-h-44 overflow-y-auto">
                                <ul className="flex flex-wrap gap-2">
                                    {timeOffRanges.map((r) => {
                                        const shiftCount = countShiftsInRange(r);
                                        return (
                                        <li
                                            key={r.id}
                                            className={`flex min-w-0 max-w-[220px] flex-1 basis-40 items-start justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${
                                                selectedRangeId === r.id ? 'border-primary bg-primary/5' : 'border-sidebar-border/50'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 shrink text-left hover:underline"
                                                onClick={() => setSelectedRangeId(selectedRangeId === r.id ? null : r.id)}
                                            >
                                                <span className="block font-medium">{r.title?.trim() || 'Need off'}</span>
                                                <span className="block text-muted-foreground">
                                                    {formatRangeShort(r.start_date, r.end_date)}
                                                    {' · '}
                                                    <span className={shiftCount === 0 ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium text-red-600 dark:text-red-400'}>
                                                        ({shiftCount} shift{shiftCount !== 1 ? 's' : ''})
                                                    </span>
                                                </span>
                                            </button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                            onClick={() => removeTimeOffRange(r.id)}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                        </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        <div className="mt-3 rounded-lg border border-sidebar-border/50 bg-muted/50 p-3 dark:bg-muted/30">
                            {selectedRange ? (
                                <>
                                    <p className="text-xs font-bold text-foreground">
                                        Shifts in {formatRangeShort(selectedRange.start_date, selectedRange.end_date)} to cover
                                    </p>
                                    {shiftsInSelectedRange.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">No shifts in this range.</p>
                                    ) : (
                                        <>
                                            <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-1 text-xs">
                                                {shiftsInSelectedRange.map((ev) => {
                                                    const ext = ev.extendedProps;
                                                    const shiftId = ext?.shiftId;
                                                    const hasPost = (ext?.posts?.length ?? 0) > 0;
                                                    const positionName = ext?.position_name ?? ((ev.title || '').replace(/\s*\[Post\]\s*$/, '').trim() || 'Shift');
                                                    return (
                                                        <li key={ev.id} className="flex items-center justify-between gap-2">
                                                            <span className="min-w-0 truncate text-muted-foreground">
                                                                {positionName} · {ev.start.slice(0, 10)}
                                                            </span>
                                                            {shiftId != null && (
                                                                <span className="flex shrink-0 items-center gap-1">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-6 px-2 text-[10px]"
                                                                        onClick={() =>
                                                                            setPostModalShift({
                                                                                shiftId,
                                                                                position_name: positionName,
                                                                                desk_type: ext?.desk_type ?? null,
                                                                                start: ev.start,
                                                                                end: ev.end ?? ev.start,
                                                                                workgroup_id: ext?.workgroup_id ?? null,
                                                                                workgroup_name: ext?.workgroup_name,
                                                                                posts: (ext?.posts ?? []).map((p) => ({
                                                                                    id: p.id,
                                                                                    type: p.type,
                                                                                    cash_amount: p.cash_amount ?? null,
                                                                                    flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                                                    flight_follow_at: p.flight_follow_at ?? null,
                                                                                    notes: p.notes ?? null,
                                                                                    preferred_start_times: p.preferred_start_times ?? null,
                                                                                })),
                                                                            })
                                                                        }
                                                                    >
                                                                        {hasPost ? 'Edit' : 'Post'}
                                                                    </Button>
                                                                    {hasPost && (ext?.posts?.length ?? 0) > 0 && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                            disabled={deletingPostShiftId === shiftId}
                                                                            onClick={() => {
                                                                                if (selectedRange && window.confirm('Remove all postings for this shift? The shift will stay on your schedule.')) {
                                                                                    removePostForShift(shiftId, (ext?.posts ?? []).map((p) => p.id), selectedRange.start_date, selectedRange.end_date);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {deletingPostShiftId === shiftId ? <span className="text-xs">…</span> : <Trash2 className="size-3.5" />}
                                                                        </Button>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                            <Button
                                                size="sm"
                                                className="mt-2 h-7 w-full"
                                                onClick={() => setBulkPostShiftIds(shiftIdsInRange)}
                                                disabled={shiftIdsInRange.length === 0}
                                            >
                                                Post {shiftIdsInRange.length} shift{shiftIdsInRange.length !== 1 ? 's' : ''}
                                            </Button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-foreground">Shifts to cover</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Select a date range above to see shifts in that range.</p>
                                </>
                            )}
                        </div>
                </section>

                <section className="flex min-h-0 flex-col rounded-xl border border-sidebar-border/50 bg-card p-3 shadow-sm min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <ArrowLeftRight className="size-3.5" />
                                My active posts
                            </h3>
                            <p className="mt-1 text-[10px] text-muted-foreground">Active until shift start.</p>
                        </div>
                        {activePosts.length > 0 && (
                            <div className="flex shrink-0 items-center gap-2">
                                <select
                                    value={activePostTypeFilter}
                                    onChange={(e) => setActivePostTypeFilter(e.target.value)}
                                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                >
                                    <option value="">All types</option>
                                    <option value="trade">Trade</option>
                                    <option value="cash">Giveaway</option>
                                    <option value="flight_follow">Flight following</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Date (3/14) or desk…"
                                    value={activePostSearch}
                                    onChange={(e) => setActivePostSearch(e.target.value)}
                                    className="h-7 w-32 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground"
                                />
                            </div>
                        )}
                    </div>
                    {activePosts.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">No open postings. Post a shift from the calendar to trade, give away, or offer flight following.</p>
                    ) : (
                        <div className="mt-2">
                            <div className="h-80 min-w-0 overflow-y-auto rounded-md border border-sidebar-border/30 bg-muted/20 p-2 dark:bg-muted/10">
                                {(() => {
                                    const groups = groupActivePosts(activePosts);
                                    const typeFilter = activePostTypeFilter.trim().toLowerCase();
                                    const search = activePostSearch.trim().toLowerCase();
                                    const filtered = groups.filter((group) => {
                                        if (typeFilter && !group.posts.some((p) => p.type === typeFilter)) return false;
                                        if (!search) return true;
                                        const shortDate = formatShortDate(group.start);
                                        const position = (group.position_name ?? '').toLowerCase();
                                        const deskLabel = group.desk_type ? getDeskTypeLabel(userWorkgroups, group.workgroup_id ?? null, group.desk_type) : '';
                                        return position.includes(search) || shortDate.includes(search) || deskLabel.toLowerCase().includes(search);
                                    });
                                    if (filtered.length === 0) {
                                        return <p className="py-2 text-xs text-muted-foreground">No posts match the filter.</p>;
                                    }
                                    return (
                                        <ul className="flex flex-wrap gap-2 pr-1">
                                            {filtered.map((group) => {
                                                const shiftDateShort = group.start ? formatShortDate(group.start) : '';
                                                return (
                                                    <li
                                                    key={`${group.shiftId}-${group.kind}`}
                                                    className={`flex min-w-[160px] max-w-[280px] flex-1 basis-48 items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                                                        group.within_24h
                                                            ? 'border-amber-500/50 bg-amber-500/10 dark:border-amber-500/40 dark:bg-amber-500/5'
                                                            : 'border-sidebar-border/50'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1 shrink">
                                                        <div className="flex flex-wrap items-baseline gap-1.5">
                                                            <span className="text-sm font-bold text-foreground truncate">
                                                                {group.position_name || 'Shift'}
                                                            </span>
                                                            {shiftDateShort && (
                                                                <span className="shrink-0 text-muted-foreground">{shiftDateShort}</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                            {group.posts.map((p) => (
                                                                <span
                                                                    key={p.id}
                                                                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                                        (p.type === 'trade' || p.type === 'time_trade')
                                                                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                                            : p.type === 'cash'
                                                                            ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                                                            : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                                    }`}
                                                                >
                                                                    {p.type === 'trade' ? 'Trade' : p.type === 'time_trade' ? 'Time trade' : p.type === 'cash' ? 'Giveaway' : 'Flight following'}
                                                                </span>
                                                            ))}
                                                            {group.within_24h && (
                                                                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-amber-500">
                                                                    Within 24h
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-start gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-xs"
                                                            onClick={() =>
                                                                setPostModalShift({
                                                                    shiftId: group.shiftId,
                                                                    position_name: group.position_name,
                                                                    desk_type: group.desk_type ?? null,
                                                                    start: group.start,
                                                                    end: group.end,
                                                                    workgroup_id: group.workgroup_id ?? null,
                                                                    workgroup_name: group.workgroup_name ?? undefined,
                                                                    posts: group.posts.map((p) => ({
                                                                        id: p.id,
                                                                        type: p.type,
                                                                        cash_amount: p.cash_amount ?? null,
                                                                        flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                                        flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                                        notes: p.notes ?? null,
                                                                        preferred_start_times: p.preferred_start_times ?? null,
                                                                    })),
                                                                })
                                                            }
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            title="Delete post"
                                                            disabled={deletingPostGroup === `${group.shiftId}-${group.kind}`}
                                                            onClick={() => deleteActivePostGroup(group)}
                                                        >
                                                            {deletingPostGroup === `${group.shiftId}-${group.kind}` ? <span className="text-xs">…</span> : <Trash2 className="size-3.5" />}
                                                        </Button>
                                                    </div>
                                                </li>
                                                );
                                            })}
                                        </ul>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </section>
                </div>

                {/* Calendar */}
                <section className="min-w-0 flex-1 space-y-2">
                    <h2 className="text-sm font-medium text-muted-foreground">Calendar</h2>
                    <div className="schedule-calendar rounded-xl border border-sidebar-border/70 bg-card p-2 sm:p-4 dark:border-sidebar-border">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            headerToolbar={{
                                left: 'title',
                                right: 'prev,next today jumpToMonth',
                            }}
                            customButtons={{
                                jumpToMonth: {
                                    text: 'Jump to month',
                                    click: (ev: MouseEvent) => {
                                        const api = calendarRef.current?.getApi?.();
                                        if (api) {
                                            const d = api.getDate();
                                            setJumpToMonth({ month: d.getMonth(), year: d.getFullYear() });
                                        }
                                        setJumpToMonthAnchor({ x: ev.clientX, y: ev.clientY });
                                        setJumpToMonthOpen(true);
                                    },
                                },
                            }}
                            events={[...timeOffToCalendarEvents(timeOffRanges), ...events.map(normalizeEventEnd)]}
                            eventContent={eventContent}
                            eventClassNames={(arg) =>
                                arg.event.end && new Date(arg.event.end) < new Date() ? ['fc-event-past'] : []
                            }
                            datesSet={handleDatesSet}
                            dateClick={handleDateClick}
                            eventClick={handleEventClick}
                            dayCellClassNames={(arg) => {
                                const d = arg.date;
                                const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                const classes: string[] = [];
                                if (datesWithEligibleGiveaway.includes(localDateStr)) classes.push('has-eligible-giveaway');
                                if (datesWithEligibleFF.includes(localDateStr)) classes.push('has-eligible-ff');
                                return classes;
                            }}
                            editable={false}
                            droppable={false}
                            height="auto"
                            contentHeight="auto"
                            aspectRatio={1.8}
                        />
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" /> Regulatory</span>
                            <span className="text-blue-600">Trade</span>
                            <span className="text-green-600">$ Cash</span>
                            <span className="text-purple-600">FF Flight follow</span>
                            <span className="text-green-600">$ on day = eligible giveaway</span>
                            <span className="text-purple-600">FF on day = eligible flight follow</span>
                            {timeOffRanges.length > 0 && (
                                <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-sm align-middle" style={{ backgroundColor: 'rgba(148, 163, 184, 0.4)' }} /> Need off</span>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Jump to month popover (near cursor) */}
            {jumpToMonthOpen && (
                <div
                    ref={jumpToMonthPopoverRef}
                    className="fixed z-50 min-w-[12rem] rounded-lg border border-border bg-popover p-3 shadow-lg"
                    style={{
                        left: (() => {
                            if (typeof window === 'undefined') return jumpToMonthAnchor.x;
                            const w = 208;
                            return Math.max(8, Math.min(jumpToMonthAnchor.x, window.innerWidth - w - 8));
                        })(),
                        top: (() => {
                            if (typeof window === 'undefined') return jumpToMonthAnchor.y + 8;
                            const h = 180;
                            const y = jumpToMonthAnchor.y + 8;
                            if (y + h > window.innerHeight - 8) return Math.max(8, jumpToMonthAnchor.y - h - 4);
                            return y;
                        })(),
                    }}
                >
                    <div className="mb-2 text-sm font-medium">Jump to month</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Month</Label>
                            <select
                                value={jumpToMonth.month}
                                onChange={(e) => setJumpToMonth((p) => ({ ...p, month: parseInt(e.target.value, 10) }))}
                                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((name, i) => (
                                    <option key={name} value={i}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Year</Label>
                            <Input
                                type="number"
                                min={2020}
                                max={2040}
                                value={jumpToMonth.year}
                                onChange={(e) => setJumpToMonth((p) => ({ ...p, year: parseInt(e.target.value, 10) || p.year }))}
                                className="mt-0.5 h-8 text-sm"
                            />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => {
                            calendarRef.current?.getApi?.().gotoDate(new Date(jumpToMonth.year, jumpToMonth.month, 1));
                            setJumpToMonthOpen(false);
                        }}
                    >
                        Go
                    </Button>
                </div>
            )}

            <Dialog open={!!modalDate} onOpenChange={(open) => !open && setModalDate(null)}>
                <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Shifts for {modalDate}</DialogTitle>
                    </DialogHeader>
                    {modalDate && modalDate >= new Date().toISOString().slice(0, 10) && (
                        <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">View posts for this date</p>
                            <p className="mb-2 text-xs text-muted-foreground">Posts you are eligible for (counts shown):</p>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="gap-1.5 text-purple-600 dark:text-purple-400" asChild>
                                    <Link href={`/app/available?date_from=${modalDate}&date_to=${modalDate}&type=flight_follow`} onClick={() => setModalDate(null)}>
                                        <Plane className="size-3.5 shrink-0" />
                                        FF
                                        {eligiblePostCounts ? ` (${eligiblePostCounts.flight_follow})` : ' (…)'}
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 dark:text-blue-400" asChild>
                                    <Link href={`/app/available?date_from=${modalDate}&date_to=${modalDate}&type=time_trade`} onClick={() => setModalDate(null)}>
                                        <Repeat strokeWidth={2.5} className="size-3.5 shrink-0" />
                                        Time trades
                                        {eligiblePostCounts ? ` (${eligiblePostCounts.time_trade})` : ' (…)'}
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 dark:text-blue-400" asChild>
                                    <Link href={`/app/available?date_from=${modalDate}&date_to=${modalDate}&type=trade`} onClick={() => setModalDate(null)}>
                                        <Handshake className="size-3.5 shrink-0" />
                                        Trade
                                        {eligiblePostCounts ? ` (${eligiblePostCounts.trade})` : ' (…)'}
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-green-600 dark:text-green-400" asChild>
                                    <Link href={`/app/available?date_from=${modalDate}&date_to=${modalDate}&type=cash`} onClick={() => setModalDate(null)}>
                                        <DollarSign className="size-3.5 shrink-0" />
                                        Giveaway
                                        {eligiblePostCounts ? ` (${eligiblePostCounts.cash})` : ' (…)'}
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">No shifts this day.</p>}
                        {dayEvents.map((ev) => {
                            const posts = ev.extendedProps?.posts ?? [];
                            const positionName = ev.extendedProps?.position_name ?? ((ev.title || '').replace(/\s*\[Post\]\s*$/, '').trim() || 'Shift');
                            const isPast = new Date(ev.end) < new Date();
                            const isPendingIncoming = ev.extendedProps?.pending_incoming;
                            const isNewShift = ev.extendedProps?.is_new_shift;
                            const newShiftNotificationId = ev.extendedProps?.new_shift_notification_id ?? null;
                            const actionRequiredOfferId = ev.extendedProps?.action_required_offer_id;
                            const actionRequiredItem = actionRequiredOfferId != null ? actionRequired.find((a) => a.id === actionRequiredOfferId) : null;
                            return (
                                <div
                                    key={ev.id}
                                    className={`flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
                                        isPendingIncoming ? 'border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30' : actionRequiredItem ? 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20' : isNewShift ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20' : isPast ? 'border-muted bg-muted/30 opacity-75' : ''
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium">{positionName}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {timeWithSubscript(formatStartTimeOnly(ev.start))}
                                            {!isPast && (
                                                <>
                                                    {' – '}
                                                    {timeWithSubscript(formatStartTimeOnly(ev.end))}
                                                </>
                                            )}
                                            {auth?.user?.time_display_preference === 'central_zulu' && (
                                                <span className="ml-1">
                                                    ({new Date(ev.start).toISOString().slice(11, 16)}Z
                                                    {!isPast && ` – ${new Date(ev.end).toISOString().slice(11, 16)}Z`})
                                                </span>
                                            )}
                                        </div>
                                        {isPendingIncoming && (
                                            <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Pending — waiting for response</div>
                                        )}
                                        {actionRequiredItem && !isPendingIncoming && (
                                            <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Action required — respond to offer</div>
                                        )}
                                        {isNewShift && !isPendingIncoming && (
                                            <div className="mt-1 text-xs font-medium text-green-700 dark:text-green-400">New shift — your response was accepted. Please check workzone to ensure the change has been made properly.</div>
                                        )}
                                        {posts.length > 0 && !isPendingIncoming && (
                                            <div className="mt-1 text-xs">
                                                Posted: {posts.map((p) => (p.type === 'trade' ? 'Trade' : p.type === 'time_trade' ? 'Time trade' : p.type === 'cash' ? 'Giveaway' : 'Flight following')).join(', ')}
                                                {posts.some((p) => p.cash_amount) && ' · $'}
                                                {posts.some((p) => p.flight_follow_minutes) && ' · FF'}
                                            </div>
                                        )}
                                    </div>
                                    {isPast ? (
                                        <span className="shrink-0 text-xs text-muted-foreground">Past</span>
                                    ) : isPendingIncoming ? (
                                        <span className="shrink-0 rounded bg-amber-200/80 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-100">Pending</span>
                                    ) : actionRequiredItem ? (
                                        <div className="flex shrink-0 flex-wrap gap-1">
                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setReviewOfferItem(actionRequiredItem); setModalDate(null); }}>
                                                Respond to offer
                                            </Button>
                                            {posts.length > 0 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setPostModalShift({
                                                            shiftId: ev.extendedProps!.shiftId,
                                                            position_name: positionName,
                                                            desk_type: ev.extendedProps?.desk_type ?? null,
                                                            start: ev.start,
                                                            end: ev.end,
                                                            workgroup_id: ev.extendedProps?.workgroup_id ?? null,
                                                            workgroup_name: ev.extendedProps?.workgroup_name,
                                                            posts: posts.map((p) => ({
                                                                id: p.id,
                                                                type: p.type,
                                                                cash_amount: p.cash_amount ?? null,
                                                                flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                                flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                                notes: p.notes ?? null,
                                                                preferred_start_times: (p as { preferred_start_times?: string[] | null }).preferred_start_times ?? null,
                                                            })),
                                                        });
                                                        setModalDate(null);
                                                    }}
                                                >
                                                    Edit post
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                                            {isNewShift && newShiftNotificationId != null && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950/30"
                                                    disabled={dismissingNotificationId === newShiftNotificationId}
                                                    onClick={() => dismissNewShiftNotification(newShiftNotificationId)}
                                                >
                                                    {dismissingNotificationId === newShiftNotificationId ? '…' : 'Acknowledge'}
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() =>
                                                    setPostModalShift({
                                                        shiftId: ev.extendedProps!.shiftId,
                                                        position_name: positionName,
                                                        desk_type: ev.extendedProps?.desk_type ?? null,
                                                        start: ev.start,
                                                        end: ev.end,
                                                        workgroup_id: ev.extendedProps?.workgroup_id ?? null,
                                                        workgroup_name: ev.extendedProps?.workgroup_name,
                                                        posts: posts.map((p) => ({
                                                            id: p.id,
                                                            type: p.type,
                                                            cash_amount: p.cash_amount ?? null,
                                                            flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                            flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                            notes: p.notes ?? null,
                                                            preferred_start_times: (p as { preferred_start_times?: string[] | null }).preferred_start_times ?? null,
                                                        })),
                                                    })
                                                }
                                            >
                                                {posts.length > 0 ? 'Edit post' : 'Post shift'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {postModalShift && (
                <PostShiftModal
                    open={!!postModalShift}
                    onOpenChange={(open) => !open && setPostModalShift(null)}
                    shift={{
                        shiftId: postModalShift.shiftId,
                        position_name: postModalShift.position_name,
                        desk_type: postModalShift.desk_type,
                        start: postModalShift.start,
                        end: postModalShift.end,
                        workgroup_id: postModalShift.workgroup_id ?? undefined,
                        workgroup_name: postModalShift.workgroup_name,
                    }}
                    allowedStartTimes={postModalShift.workgroup_id != null ? (userWorkgroups.find((w) => w.id === postModalShift.workgroup_id)?.allowed_start_times ?? []) : []}
                    workgroups={userWorkgroups}
                    existingPosts={postModalShift.posts}
                    preselectFlightFollow={postModalShift.preselectFlightFollow}
                    onSuccess={handlePostSuccess}
                    onDeleteShift={() => {
                        fetchEvents();
                        router.reload({ only: DASHBOARD_RELOAD_ONLY });
                    }}
                />
            )}

            <Dialog open={reviewOfferItem != null} onOpenChange={(open) => { if (!open) { setReviewOfferItem(null); setReviewSelectedShiftId(null); setReviewHideNeedOff(false); setOfferRespondError(null); } }}>
                <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Review response</DialogTitle>
                        <p className="text-sm font-normal text-muted-foreground">
                            Accept only once the proper positive contact has been made and the change in workzone has been input.
                        </p>
                    </DialogHeader>
                    {reviewOfferItem && (() => {
                        const isTrade = reviewOfferItem.post_type === 'trade' || reviewOfferItem.post_type === 'time_trade';
                        const isCash = reviewOfferItem.post_type === 'cash';
                        const isFlightFollow = reviewOfferItem.post_type === 'flight_follow';
                        const offeredShifts = reviewOfferItem.offered_shifts ?? [];
                        const selectedId = reviewSelectedShiftId ?? offeredShifts[0]?.id ?? null;
                        const offererName = reviewOfferItem.offered_by_name ?? 'Someone';
                        const cashLabel = reviewOfferItem.cash_amount != null && reviewOfferItem.cash_amount > 0
                            ? ` for $${Number(reviewOfferItem.cash_amount).toFixed(0)}`
                            : ' for the cash amount';
                        return (
                        <div className="space-y-4 py-2">
                            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                <p className="font-medium">
                                    {isCash && `${offererName} wants your shift${cashLabel}`}
                                    {isTrade && (offeredShifts.length > 0
                                        ? `${offererName} offered these days in exchange for working the posted shift`
                                        : `${offererName} offered a trade`)}
                                    {isFlightFollow && `${offererName} responded to your flight following`}
                                    {!isCash && !isTrade && !isFlightFollow && `${offererName} responded to your ${postTypeLabel(reviewOfferItem.post_type)}`}
                                    {reviewOfferItem.position_name && ` · ${reviewOfferItem.position_name}`}
                                </p>
                                {reviewOfferItem.start_time_utc && (
                                    <p className="mt-1 text-muted-foreground">{formatCentral(reviewOfferItem.start_time_utc)}</p>
                                )}
                                {isTrade && offeredShifts.length === 0 && reviewOfferItem.offered_shift_summary && (
                                    <p className="mt-1 text-muted-foreground">Offered: {reviewOfferItem.offered_shift_summary}</p>
                                )}
                                {reviewOfferItem.offered_by_contact && (
                                    <p className="mt-1.5 text-sm">
                                        <span className="font-medium text-foreground">Contact: </span>
                                        <span className="text-muted-foreground">{reviewOfferItem.offered_by_contact}</span>
                                    </p>
                                )}
                                {reviewOfferItem.response_notes && (
                                    <div className="mt-2 rounded border border-border/70 bg-muted/30 p-2 text-sm">
                                        <span className="font-medium text-foreground">Notes from responder: </span>
                                        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{reviewOfferItem.response_notes}</p>
                                    </div>
                                )}
                            </div>
                            {isTrade && offeredShifts.length > 0 && (() => {
                                const posterShiftDates = new Set(
                                    events.filter((ev) => ev.extendedProps?.shiftId).map((ev) => ev.start.slice(0, 10))
                                );
                                const postedShiftDate = reviewOfferItem.start_time_utc?.slice(0, 10) ?? null;
                                return (
                                <div className="space-y-2">
                                    {timeOffRanges.length > 0 && (
                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={reviewHideNeedOff}
                                                onChange={(e) => setReviewHideNeedOff(e.target.checked)}
                                                className="h-4 w-4 rounded border-input"
                                            />
                                            <span>Hide shifts I need off</span>
                                        </label>
                                    )}
                                    <p className="text-sm font-medium">Select which shift to accept (offered in preference order):</p>
                                    {visibleOfferedShifts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            {reviewHideNeedOff ? 'All offered shifts are on days you need off. Turn off the filter above to see them.' : 'No shifts to show.'}
                                        </p>
                                    ) : (
                                    <ul className="space-y-1.5">
                                        {visibleOfferedShifts.map((s, idx) => {
                                            const offerDate = s.start_time_utc?.slice(0, 10) ?? '';
                                            const shiftDatesAfterAccept = new Set(posterShiftDates);
                                            if (postedShiftDate) shiftDatesAfterAccept.delete(postedShiftDate);
                                            if (offerDate) shiftDatesAfterAccept.add(offerDate);
                                            const { daysOffBefore, daysOffAfter } = offerDate
                                                ? getDaysOffBeforeAfter(offerDate, shiftDatesAfterAccept)
                                                : { daysOffBefore: 0, daysOffAfter: 0 };
                                            const inTimeOff = offerDate ? isDateInTimeOffRanges(offerDate, timeOffRanges) : false;
                                            const wouldBeDouble = Boolean(
                                                offerDate && offerDate !== postedShiftDate && posterShiftDates.has(offerDate)
                                            );
                                            return (
                                            <li key={s.id}>
                                                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                                    <input
                                                        type="radio"
                                                        name="review-selected-shift"
                                                        checked={selectedId === s.id}
                                                        onChange={() => setReviewSelectedShiftId(s.id)}
                                                        className="mt-1 h-4 w-4 shrink-0 border-input"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="font-medium">{s.position_name}</span>
                                                        <span className="ml-1.5 text-muted-foreground text-xs">
                                                            {formatCentral(s.start_time_utc)}
                                                        </span>
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {daysOffBefore > 0 && (
                                                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                                                    {daysOffBefore === 1 ? '1 day off before' : `${daysOffBefore} days off before`}
                                                                </span>
                                                            )}
                                                            {daysOffAfter > 0 && (
                                                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                                                    {daysOffAfter === 1 ? '1 day off after' : `${daysOffAfter} days off after`}
                                                                </span>
                                                            )}
                                                            {inTimeOff && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 cursor-help">
                                                                            Need off
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="max-w-xs">
                                                                        {getTimeOffRangeTitleForDate(offerDate, timeOffRanges) ?? 'Need off'} — this shift falls on a day you need off.
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                            {wouldBeDouble && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 cursor-help">
                                                                            Double
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="max-w-xs">
                                                                        Accepting this would give you two shifts on the same day.
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </span>
                                                    {idx === 0 && <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">1st choice</span>}
                                                </label>
                                            </li>
                                            );
                                        })}
                                    </ul>
                                    )}
                                </div>
                                );
                            })()}
                            {offerRespondError && (
                                <p className="text-sm text-destructive">{offerRespondError}</p>
                            )}
                            <div className="flex flex-wrap gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => handleRespondToOffer(reviewOfferItem.id, 'reject')}
                                    disabled={offerResponding != null}
                                >
                                    {offerResponding === 'reject' ? 'Declining…' : 'Decline'}
                                </Button>
                                <Button
                                    onClick={() => handleRespondToOffer(reviewOfferItem.id, 'accept', isTrade && offeredShifts.length > 0 ? (selectedId ?? undefined) : undefined)}
                                    disabled={offerResponding != null}
                                >
                                    {offerResponding === 'accept' ? 'Accepting…' : 'Accept'}
                                </Button>
                            </div>
                        </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            <BulkPostModal
                open={bulkPostShiftIds !== null && bulkPostShiftIds.length > 0}
                onOpenChange={(open) => !open && setBulkPostShiftIds(null)}
                shiftIds={bulkPostShiftIds ?? []}
                shiftCountLabel={selectedRange ? `Shifts in ${formatRangeShort(selectedRange.start_date, selectedRange.end_date)}` : undefined}
                onSuccess={() => {
                    handlePostSuccess();
                    setBulkPostShiftIds(null);
                }}
            />

            <AddShiftModal
                open={showAddShiftModal}
                onOpenChange={setShowAddShiftModal}
                workgroups={userWorkgroups}
                defaultWorkgroupId={defaultWorkgroupId}
                defaultRegulatory={userIsDispatch}
                onSuccess={handlePostSuccess}
            />
        </AppLayout>
    );
}