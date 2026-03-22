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
import { Briefcase, CalendarOff, Trash2, MessageSquare, Check, Pencil, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState  } from 'react';
import type {ReactNode} from 'react';
import { AddShiftModal } from '@/components/add-shift-modal';
import { BulkPostModal } from '@/components/bulk-post-modal';
import { PostLfwModal } from '@/components/post-lfw-modal';
import { PostShiftModal  } from '@/components/post-shift-modal';
import type {ExistingPost} from '@/components/post-shift-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import { dashboard, importSchedule } from '@/routes';
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
    preferred_desk_type?: string | null;
    payback_date_ranges?: { start: string; end: string }[] | null;
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
    is_training?: boolean;
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
        const isTraining = (first as { is_training?: boolean })?.is_training ?? false;
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
                is_training: isTraining,
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
                is_training: isTraining,
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
                is_training: isTraining,
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
    /** True = in poster's payback range, false = outside, null = post has no payback ranges */
    in_payback_range?: boolean | null;
};

/** One shift in the combined multi-offer list (flattened from all offers on a post) */
type CombinedOfferedShift = {
    shiftId: number;
    position_name: string;
    start_time_utc: string;
    end_time_utc?: string;
    in_payback_range?: boolean | null;
    offerId: number;
    offeredByName: string;
    counter_cash_amount?: number | null;
    /** 1-based: 1 = 1st choice, 2 = 2nd choice, etc. */
    preferenceOrder: number;
    /** ISO string for sort order (who responded first) */
    offerCreatedAt: string;
};

type ActionRequiredItem = {
    id: number;
    action_type?: 'swap_offer' | 'looking_for_work_offer';
    swap_post_id?: number;
    looking_for_work_post_id?: number;
    shift_id?: number | null;
    post_type?: string;
    position_name?: string | null;
    start_time_utc?: string | null;
    end_time_utc?: string | null;
    seeking_date?: string;
    seeking_cash?: number | null;
    seeking_obo?: boolean;
    /** Desk types the poster asked for (LFW) */
    seeking_desk_types?: string[] | null;
    /** Poster’s notes on the LFW or swap post */
    post_notes?: string | null;
    offered_by_name?: string;
    offered_by_contact?: string | null;
    offered_by_contact_method?: string | null;
    response_notes?: string | null;
    offered_shift_summary?: string | null;
    offered_shifts?: OfferedShiftOption[];
    cash_amount?: number | null;
    /** Responder's counter cash offer (e.g. offering more than poster asked) */
    counter_cash_amount?: number | null;
    /** Poster's payback date ranges (for display in review) */
    payback_date_ranges?: { start: string; end: string }[] | null;
    /** When the offer was created (for sort: who responded first) */
    offer_created_at?: string | null;
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
        is_training?: boolean;
        posts?: { id: number; type: string; cash_amount?: number | null; flight_follow_minutes?: number | null; flight_follow_at?: string | null; notes?: string | null; preferred_start_times?: string[] | null; preferred_desk_type?: string | null; payback_date_ranges?: { start: string; end: string }[] | null }[];
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

type ActiveLookingForWorkPost = {
    id: number;
    seeking_date: string;
    seeking_cash: number | null;
    seeking_obo: boolean;
    seeking_desk_types: string[];
    notes?: string | null;
    willing_to_follow?: boolean;
    willing_to_follow_time_frame?: string | null;
    willing_to_follow_slots?: string[];
    willing_to_follow_custom?: string | null;
    pending_offer_count: number;
};

type LfwDateRangePuck = {
    id: number;
    title: string;
    dateFrom: string;
    dateTo: string;
};

const DASHBOARD_RELOAD_ONLY = ['activePosts', 'activeLookingForWorkPosts', 'actionRequired', 'currentShift', 'todayShift', 'nextShift', 'upcomingShifts', 'timeOffRanges', 'lfwDateRanges', 'initialEvents', 'lastWorkzoneSyncAt'] as const;

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

function formatPaybackRanges(ranges: { start: string; end: string }[] | null | undefined): string {
    if (!ranges?.length) return '';
    return ranges
        .map((r) => {
            try {
                const start = new Date(r.start + 'T12:00:00');
                const end = new Date(r.end + 'T12:00:00');
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
                const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return start.getTime() === end.getTime() ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
            } catch {
                return '';
            }
        })
        .filter(Boolean)
        .join(', ');
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

/** Count consecutive work days (days with a shift) including the given date. */
function getConsecutiveWorkDaysIncluding(dateStr: string, shiftDates: Set<string>, maxDays = 31): number {
    if (!dateStr || !shiftDates.has(dateStr)) return 0;
    let count = 1;
    for (let i = 1; i <= maxDays; i++) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() - i);
        const beforeStr = d.toISOString().slice(0, 10);
        if (shiftDates.has(beforeStr)) count++;
        else break;
    }
    for (let i = 1; i <= maxDays; i++) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + i);
        const afterStr = d.toISOString().slice(0, 10);
        if (shiftDates.has(afterStr)) count++;
        else break;
    }
    return count;
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
        todayShift?: ShiftSummary | null;
        nextShift?: ShiftSummary | null;
        upcomingShifts?: ShiftSummary[];
        activePosts?: ActivePost[];
        activeLookingForWorkPosts?: ActiveLookingForWorkPost[];
        actionRequired?: ActionRequiredItem[];
        initialEvents?: CalendarEvent[];
        timeOffRanges?: TimeOffRange[];
        lfwDateRanges?: LfwDateRangePuck[];
        userWorkgroups?: { id: number; name: string; allowed_start_times?: { start_time: string; default_duration_minutes: number }[]; desk_types?: { code: string; label: string }[] }[];
        userIsDispatch?: boolean;
        defaultWorkgroupId?: number | null;
        bannerMessages?: BannerMessage[];
        lastWorkzoneSyncAt?: string | null;
        auth?: { user?: { time_display_preference?: string } };
    };
    const currentShift = props.currentShift ?? null;
    const todayShift = props.todayShift ?? null;
    const nextShift = props.nextShift ?? null;
    const upcomingShifts = props.upcomingShifts ?? [];
    const activePosts = props.activePosts ?? [];
    const activeLookingForWorkPosts = props.activeLookingForWorkPosts ?? [];
    const actionRequired = useMemo(() => props.actionRequired ?? [], [props.actionRequired]);
    const auth = props.auth;
    const [events, setEvents] = useState<CalendarEvent[]>(props.initialEvents ?? []);

    // When server sends fresh initialEvents (e.g. after accepting a swap), sync to calendar so shifts reflect correctly
    useEffect(() => {
        if (Array.isArray(props.initialEvents)) {
            setEvents(props.initialEvents);
        }
    }, [props.initialEvents]);
    const [bannerMessages, setBannerMessages] = useState<BannerMessage[]>(props.bannerMessages ?? []);
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
        is_training?: boolean;
        posts: ExistingPost[];
        preselectFlightFollow?: boolean;
    } | null>(null);
    /** Edit shift (full) from the day popup */
    const [editShiftInDay, setEditShiftInDay] = useState<{
        shiftId: number;
        position_name: string;
        desk_type: string | null;
        workgroup_id: number | null;
        workgroup_name?: string;
        start: string;
        end: string;
        regulatory: boolean;
    } | null>(null);
    const [editShiftWorkgroupId, setEditShiftWorkgroupId] = useState('');
    const [editShiftPositionName, setEditShiftPositionName] = useState('');
    const [editShiftDeskType, setEditShiftDeskType] = useState('');
    const [editShiftDate, setEditShiftDate] = useState('');
    const [editShiftTime, setEditShiftTime] = useState('');
    const [editShiftNonStandard, setEditShiftNonStandard] = useState(false);
    const [editShiftEndDate, setEditShiftEndDate] = useState('');
    const [editShiftEndTime, setEditShiftEndTime] = useState('');
    const [editShiftRegulatory, setEditShiftRegulatory] = useState(false);
    const [editShiftSaving, setEditShiftSaving] = useState(false);
    /** Remove shift confirm from the day popup */
    const [removeShiftConfirm, setRemoveShiftConfirm] = useState<{ shiftId: number; positionName: string } | null>(null);
    const [removeShiftDeleting, setRemoveShiftDeleting] = useState(false);
    const [datePopupPostsOpen, setDatePopupPostsOpen] = useState(false);
    /** Find FF modal: show LFW flight-follow posts for next shift date, or offer to post FF / LFW. */
    const [findFFModal, setFindFFModal] = useState<{
        date: string;
        lfwCount: number;
        lfwPosts: { id: number; poster_name: string | null; seeking_date: string }[];
        forShift?: ShiftSummary | null;
    } | null>(null);
    const [findFFLoading, setFindFFLoading] = useState(false);
    /** Post LFW modal (from calendar date popup or Find FF). */
    const [lfwModalOpen, setLfwModalOpen] = useState(false);
    const [lfwModalDate, setLfwModalDate] = useState('');
    const [lfwModalWilling, setLfwModalWilling] = useState(false);
    const [lfwModalTimeFrame, setLfwModalTimeFrame] = useState<'before' | 'after' | 'any' | null>(null);
    /** FF modal: find people willing to follow before/after shift, or post LFW. */
    const [ffModalOpen, setFfModalOpen] = useState(false);
    const [ffModalStep, setFfModalStep] = useState<'before_after' | 'results'>('before_after');
    const [ffModalTimeFrame, setFfModalTimeFrame] = useState<'before' | 'after' | null>(null);
    const [ffModalDate, setFfModalDate] = useState('');
    const [ffModalPosts, setFfModalPosts] = useState<{ id: number; poster_name: string | null; seeking_date: string }[]>([]);
    const [ffModalLoading, setFfModalLoading] = useState(false);
    const [reviewOfferItem, setReviewOfferItem] = useState<ActionRequiredItem | null>(null);
    /** When multiple LFW offers for same post, show all in one modal. */
    const [reviewLfwOfferGroup, setReviewLfwOfferGroup] = useState<ActionRequiredItem[] | null>(null);
    /** When multiple swap offers for same post (giveaway, trade, etc.), show all in one modal. */
    const [reviewSwapOfferGroup, setReviewSwapOfferGroup] = useState<ActionRequiredItem[] | null>(null);
    /** For trade/time_trade: which of the offered shifts the poster selected to accept (single-offer view). */
    const [reviewSelectedShiftId, setReviewSelectedShiftId] = useState<number | null>(null);
    /** For multi-offer view: which (offer, shift) the poster selected to accept. */
    const [reviewSelectedCombinedShift, setReviewSelectedCombinedShift] = useState<{ offerId: number; shiftId: number } | null>(null);
    /** Multi-offer: only show shifts within poster's payback range. */
    const [reviewOnlyPaybackRange, setReviewOnlyPaybackRange] = useState(false);
    /** When true, hide offered shifts that fall on days the poster needs off. */
    const [reviewHideNeedOff, setReviewHideNeedOff] = useState(false);
    const [offerResponding, setOfferResponding] = useState<'accept' | 'reject' | null>(null);
    const [offerRespondError, setOfferRespondError] = useState<string | null>(null);
    const calendarRef = useRef<{ getApi: () => { gotoDate: (d: Date) => void } }>(null);
    const calendarRangeRef = useRef<{ startStr: string; endStr: string }>({ startStr: '', endStr: '' });
    const calendarCachedRangeRef = useRef<{ startStr: string; endStr: string } | null>(null);
    const [calendarEventsLoading, setCalendarEventsLoading] = useState(false);
    const [jumpToMonthOpen, setJumpToMonthOpen] = useState(false);
    const [jumpToMonthAnchor, setJumpToMonthAnchor] = useState({ x: 0, y: 0 });
    const jumpToMonthPopoverRef = useRef<HTMLDivElement>(null);
    const [jumpToMonth, setJumpToMonth] = useState(() => {
        const d = new Date();
        return { month: d.getMonth(), year: d.getFullYear() };
    });
    const [editLfwPost, setEditLfwPost] = useState<ActiveLookingForWorkPost | null>(null);
    const [editLfwForm, setEditLfwForm] = useState<{ date: string; cash: string; obo: boolean; deskTypes: string[]; notes: string } | null>(null);
    const [editLfwSaving, setEditLfwSaving] = useState(false);
    const [deletingLfwPostId, setDeletingLfwPostId] = useState<number | null>(null);
    const [dashboardLeftTab, setDashboardLeftTab] = useState<'overview' | 'time_off' | 'active_posts'>('overview');
    const [bulkLfwFrom, setBulkLfwFrom] = useState('');
    const [bulkLfwTo, setBulkLfwTo] = useState('');
    /** Date range pucks in Time off tab: title + range; expand to show off-dates and post actions. Persisted in DB. */
    const [rangePucks, setRangePucks] = useState<LfwDateRangePuck[]>(props.lfwDateRanges ?? []);
    const [expandedPuckId, setExpandedPuckId] = useState<number | null>(null);
    const [bulkLfwRangeTitle, setBulkLfwRangeTitle] = useState('LFW');
    const [postingLfwDate, setPostingLfwDate] = useState<string | null>(null);
    const [postingLfwAllPuckId, setPostingLfwAllPuckId] = useState<number | null>(null);
    const [addingLfwPuck, setAddingLfwPuck] = useState(false);

    useEffect(() => {
        if (Array.isArray(props.lfwDateRanges)) {
            setRangePucks(props.lfwDateRanges);
        }
    }, [props.lfwDateRanges]);

    const fetchEvents = useCallback(async (start?: string, end?: string) => {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const res = await fetch(`/api/calendar/events?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json().catch(() => null);
            setEvents((prev) => (Array.isArray(data) ? data : prev));
        }
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
            const r = calendarRangeRef.current;
            if (r.startStr && r.endStr) {
                const start = new Date(r.startStr);
                const end = new Date(r.endStr);
                const fetchStart = new Date(start.getFullYear(), start.getMonth() - 1, 1).toISOString();
                const fetchEnd = new Date(end.getFullYear(), end.getMonth() + 2, 0, 23, 59, 59, 999).toISOString();
                fetchEvents(fetchStart, fetchEnd);
            }
        }, 30000);
        return () => clearInterval(t);
    }, [fetchEvents]);

    useEffect(() => {
        const t = setInterval(() => {
            router.reload({ only: ['actionRequired'] });
        }, 45000);
        return () => clearInterval(t);
    }, []);

    // Open offer modal when arriving via push click (e.g. /app?open_offer=123)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const offerIdParam = params.get('open_offer');
        if (offerIdParam && actionRequired.length > 0) {
            const offerId = parseInt(offerIdParam, 10);
            if (Number.isFinite(offerId)) {
                const item = actionRequired.find((a) => a.id === offerId);
                if (item) setReviewOfferItem(item);
            }
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
    }, [actionRequired]);

    const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
        calendarRangeRef.current = { startStr: arg.startStr, endStr: arg.endStr };
        const cached = calendarCachedRangeRef.current;
        const visibleInCache = cached && arg.startStr >= cached.startStr && arg.endStr <= cached.endStr;
        if (visibleInCache) {
            // Already have events for this range (e.g. prefetched); no fetch, no loading
        } else {
            const start = new Date(arg.startStr);
            const end = new Date(arg.endStr);
            const fetchStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
            const fetchEnd = new Date(end.getFullYear(), end.getMonth() + 2, 0, 23, 59, 59, 999);
            const fetchStartStr = fetchStart.toISOString();
            const fetchEndStr = fetchEnd.toISOString();
            const isFirstRange = calendarCachedRangeRef.current === null;
            if (!isFirstRange) {
                setCalendarEventsLoading(true);
                setEvents([]);
            }
            fetchEvents(fetchStartStr, fetchEndStr).then(() => {
                calendarCachedRangeRef.current = { startStr: fetchStartStr, endStr: fetchEndStr };
            }).finally(() => setCalendarEventsLoading(false));
        }
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

    function isoToTimeLocal(iso: string): string {
        try {
            const d = new Date(iso);
            return d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour12: false, hour: '2-digit', minute: '2-digit' });
        } catch {
            return iso.slice(11, 16) || '';
        }
    }
    function normalizeHhmm(s: string): string {
        const parts = s.trim().split(':');
        const h = parseInt(parts[0] ?? '0', 10) || 0;
        const m = parseInt(parts[1] ?? '0', 10) || 0;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const openEditShiftInDay = useCallback((data: {
        shiftId: number;
        position_name: string;
        desk_type?: string | null;
        workgroup_id?: number | null;
        workgroup_name?: string;
        start: string;
        end: string;
        regulatory?: boolean;
    }) => {
        setEditShiftInDay({
            shiftId: data.shiftId,
            position_name: data.position_name,
            desk_type: data.desk_type ?? null,
            workgroup_id: data.workgroup_id ?? null,
            workgroup_name: data.workgroup_name,
            start: data.start,
            end: data.end,
            regulatory: data.regulatory ?? false,
        });
        setEditShiftWorkgroupId(data.workgroup_id != null ? String(data.workgroup_id) : '');
        setEditShiftPositionName(data.position_name);
        setEditShiftDeskType(data.desk_type ?? '');
        setEditShiftDate(data.start.slice(0, 10));
        setEditShiftTime(isoToTimeLocal(data.start));
        const startDt = new Date(data.start);
        const endDt = new Date(data.end);
        const sameDay = data.start.slice(0, 10) === data.end.slice(0, 10);
        const durationMs = endDt.getTime() - startDt.getTime();
        const standardDuration = 8 * 60 * 60 * 1000;
        setEditShiftNonStandard(!sameDay || Math.abs(durationMs - standardDuration) > 60 * 1000);
        setEditShiftEndDate(data.end.slice(0, 10));
        setEditShiftEndTime(isoToTimeLocal(data.end));
        setEditShiftRegulatory(data.regulatory ?? false);
    }, []);
    const saveEditShiftInDay = useCallback(async () => {
        if (!editShiftInDay || !editShiftDate || !editShiftPositionName.trim()) return;
        setEditShiftSaving(true);
        try {
            const body: Record<string, unknown> = {
                start_date: editShiftDate,
                start_time: normalizeHhmm(editShiftTime),
                position_name: editShiftPositionName.trim(),
                desk_type: editShiftDeskType || null,
                regulatory: editShiftRegulatory,
            };
            if (editShiftWorkgroupId) {
                body.workgroup_id = parseInt(editShiftWorkgroupId, 10);
            }
            if (editShiftNonStandard && editShiftEndDate && editShiftEndTime) {
                body.end_date = editShiftEndDate;
                body.end_time = normalizeHhmm(editShiftEndTime);
            }
            const res = await fetch(`/api/shifts/${editShiftInDay.shiftId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setEditShiftInDay(null);
                setModalDate(null);
                handlePostSuccess();
            } else {
                const data = await res.json().catch(() => ({}));
                window.alert(data.message || (data.errors ? Object.values(data.errors).flat().join(' ') : 'Failed to update shift.'));
            }
        } finally {
            setEditShiftSaving(false);
        }
    }, [editShiftInDay, editShiftDate, editShiftTime, editShiftPositionName, editShiftWorkgroupId, editShiftDeskType, editShiftRegulatory, editShiftNonStandard, editShiftEndDate, editShiftEndTime, handlePostSuccess]);
    const confirmRemoveShiftInDay = useCallback(async () => {
        if (!removeShiftConfirm) return;
        setRemoveShiftDeleting(true);
        try {
            const res = await fetch(`/api/shifts/${removeShiftConfirm.shiftId}`, {
                method: 'DELETE',
                headers: { 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            if (res.ok) {
                setRemoveShiftConfirm(null);
                setModalDate(null);
                handlePostSuccess();
            }
        } finally {
            setRemoveShiftDeleting(false);
        }
    }, [removeShiftConfirm, handlePostSuccess]);

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

    useEffect(() => {
        if (reviewSwapOfferGroup?.length) {
            setReviewOnlyPaybackRange(false);
            const byPreferenceThenFirst = [...reviewSwapOfferGroup].sort((a, b) =>
                (a.offer_created_at ?? '').localeCompare(b.offer_created_at ?? '')
            );
            const firstOffer = byPreferenceThenFirst[0];
            const firstShift = firstOffer?.offered_shifts?.[0];
            if (firstShift) {
                setReviewSelectedCombinedShift({ offerId: firstOffer.id, shiftId: firstShift.id });
            } else {
                setReviewSelectedCombinedShift(null);
            }
        } else {
            setReviewSelectedCombinedShift(null);
        }
    }, [reviewSwapOfferGroup]);

    useEffect(() => {
        if (editLfwPost) {
            setEditLfwForm({
                date: editLfwPost.seeking_date,
                cash: String(editLfwPost.seeking_cash ?? 0),
                obo: editLfwPost.seeking_obo,
                deskTypes: editLfwPost.seeking_desk_types ?? [],
                notes: editLfwPost.notes ?? '',
            });
        } else {
            setEditLfwForm(null);
        }
    }, [editLfwPost]);

    const visibleOfferedShifts = useMemo(() => {
        const offered = reviewOfferItem?.offered_shifts ?? [];
        if (!reviewHideNeedOff || timeOffRanges.length === 0) return offered;
        return offered.filter(
            (s) => !isDateInTimeOffRanges(s.start_time_utc?.slice(0, 10) ?? '', timeOffRanges)
        );
    }, [reviewOfferItem?.offered_shifts, reviewHideNeedOff, timeOffRanges]);

    /** Flatten all offers on a post into one list; sort by 1st choice first, then by who responded first (oldest first). */
    const combinedOfferedShifts = useMemo((): CombinedOfferedShift[] => {
        if (!reviewSwapOfferGroup || reviewSwapOfferGroup.length === 0) return [];
        const out: CombinedOfferedShift[] = [];
        for (const item of reviewSwapOfferGroup) {
            const name = item.offered_by_name ?? 'Someone';
            const createdAt = item.offer_created_at ?? '';
            (item.offered_shifts ?? []).forEach((s, idx) => {
                out.push({
                    shiftId: s.id,
                    position_name: s.position_name,
                    start_time_utc: s.start_time_utc,
                    end_time_utc: s.end_time_utc,
                    in_payback_range: s.in_payback_range,
                    offerId: item.id,
                    offeredByName: name,
                    counter_cash_amount: item.counter_cash_amount,
                    preferenceOrder: idx + 1,
                    offerCreatedAt: createdAt,
                });
            });
        }
        return out.sort((a, b) => {
            if (a.preferenceOrder !== b.preferenceOrder) return a.preferenceOrder - b.preferenceOrder;
            return a.offerCreatedAt.localeCompare(b.offerCreatedAt);
        });
    }, [reviewSwapOfferGroup]);

    const visibleCombinedShifts = useMemo(() => {
        let list = combinedOfferedShifts;
        if (reviewHideNeedOff && timeOffRanges.length > 0) {
            list = list.filter(
                (s) => !isDateInTimeOffRanges(s.start_time_utc?.slice(0, 10) ?? '', timeOffRanges)
            );
        }
        if (reviewOnlyPaybackRange) {
            list = list.filter((s) => s.in_payback_range === true);
        }
        return list;
    }, [combinedOfferedShifts, reviewHideNeedOff, timeOffRanges, reviewOnlyPaybackRange]);

    /** Group action items by post so we show one row per post; multiple offers = one review. */
    const groupedActionRequired = useMemo(() => {
        const lfw = actionRequired.filter((a) => a.action_type === 'looking_for_work_offer');
        const swap = actionRequired.filter((a) => a.action_type !== 'looking_for_work_offer');
        const lfwByPost = new Map<number, ActionRequiredItem[]>();
        for (const item of lfw) {
            const pid = item.looking_for_work_post_id ?? 0;
            if (!lfwByPost.has(pid)) lfwByPost.set(pid, []);
            lfwByPost.get(pid)!.push(item);
        }
        const swapByPost = new Map<number, ActionRequiredItem[]>();
        for (const item of swap) {
            const pid = item.swap_post_id ?? 0;
            if (!swapByPost.has(pid)) swapByPost.set(pid, []);
            swapByPost.get(pid)!.push(item);
        }
        return [
            ...Array.from(swapByPost.values()).map((group) => ({ single: group[0], group: group.length > 1 ? group : null })),
            ...Array.from(lfwByPost.values()).map((group) => ({ single: group[0], group: group.length > 1 ? group : null })),
        ];
    }, [actionRequired]);

    /** Dates that have at least one shift (from calendar events). */
    const datesWithShifts = useMemo(() => {
        const set = new Set<string>();
        for (const ev of events) {
            if (ev.extendedProps?.shiftId && ev.start) {
                set.add(ev.start.slice(0, 10));
            }
        }
        return set;
    }, [events]);

    useEffect(() => {
        if (reviewHideNeedOff && visibleOfferedShifts.length > 0 && reviewSelectedShiftId != null) {
            const isVisible = visibleOfferedShifts.some((s) => s.id === reviewSelectedShiftId);
            if (!isVisible) {
                setReviewSelectedShiftId(visibleOfferedShifts[0].id);
            }
        }
    }, [reviewHideNeedOff, visibleOfferedShifts, reviewSelectedShiftId]);

    const handleRespondToOffer = useCallback(async (item: ActionRequiredItem, action: 'accept' | 'reject', selectedShiftId?: number | null) => {
        const offerId = item.id;
        const isLfw = item.action_type === 'looking_for_work_offer';
        setOfferRespondError(null);
        setOfferResponding(action);
        try {
            const url = isLfw
                ? `/api/looking-for-work/offers/${offerId}/${action}`
                : `/api/offers/${offerId}/${action}`;
            const body = !isLfw && action === 'accept' && selectedShiftId != null ? { selected_shift_id: selectedShiftId } : {};
            const res = await fetch(url, {
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
                setReviewLfwOfferGroup(null);
                setReviewSwapOfferGroup(null);
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
                    'X-XSRF-TOKEN': getCsrfToken(),
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
    }, [selectedRange]);

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

    /** When opening the date popup for a day with no shifts, show the "View posts" section so the available post box is visible. */
    useEffect(() => {
        if (modalDateOnly && dayEvents.length === 0 && modalDateOnly >= new Date().toISOString().slice(0, 10)) {
            setDatePopupPostsOpen(true);
        }
    }, [modalDateOnly, dayEvents.length]);

    /** Shift shown in top of card: active now, or today's shift (starts later today) */
    const currentOrTodayShift = currentShift ?? todayShift ?? null;
    /** Shift shown in "Next" section: the one after current/today (or next if none) */
    const displayNextShift =
        currentShift
            ? nextShift
            : todayShift && nextShift?.id === todayShift.id
                ? (upcomingShifts.find((s) => s.id !== todayShift.id) ?? null)
                : nextShift;

    const onFindFFClick = useCallback(
        async (forShift: ShiftSummary | null) => {
            if (!forShift?.start_time_utc) return;
            const date = forShift.start_time_utc.slice(0, 10);
            if (date < new Date().toISOString().slice(0, 10)) return;
            setFindFFLoading(true);
            setFindFFModal(null);
            try {
                const res = await fetch(`/api/looking-for-work/posts-for-date?date=${encodeURIComponent(date)}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'include',
                });
                const data = await res.json().catch(() => ({}));
                const lfwPosts = Array.isArray(data.lfw_ff_posts) ? data.lfw_ff_posts : [];
                const lfwCount = typeof data.lfw_ff_count === 'number' ? data.lfw_ff_count : lfwPosts.length;
                setFindFFModal({ date, lfwCount, lfwPosts, forShift });
            } finally {
                setFindFFLoading(false);
            }
        },
        []
    );

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
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        My Schedule
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Manage your shifts and availability.
                    </p>
                </div>

                {/* Two columns: Current/Next shift (one card) | Tabs (Time off, Available to work, My active posts) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Current (or imminent) + Next shift in same card */}
                    <section className="min-w-0 rounded-xl border border-sidebar-border/50 bg-gradient-to-br from-teal-50 to-emerald-50/80 p-3 shadow-sm dark:from-teal-950/30 dark:to-emerald-950/20">
                        {/* Top: current shift (active now) or today's shift (starts later today) */}
                        {currentOrTodayShift && (
                            <div
                                className={
                                    currentShift
                                        ? 'rounded-lg border border-green-600/40 bg-green-500/10 p-2.5 dark:border-green-500/40'
                                        : 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 dark:border-amber-500/40'
                                }
                            >
                                <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {currentShift ? 'Now' : 'Today'}
                                </h3>
                                <p className="mt-0.5 font-semibold text-foreground">{currentOrTodayShift.position_name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatTime(currentOrTodayShift.start_time_utc)} – {formatTime(currentOrTodayShift.end_time_utc)}
                                    {currentOrTodayShift.workgroup_name && ` · ${currentOrTodayShift.workgroup_name}`}
                                </p>
                                {/* When shift has started: FF options only; when today (not started): Post, Find FF, Be A FF — same order as Next shift */}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {!currentShift && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7"
                                            onClick={() =>
                                                setPostModalShift({
                                                    shiftId: currentOrTodayShift.id,
                                                    position_name: currentOrTodayShift.position_name,
                                                    desk_type: currentOrTodayShift.desk_type ?? null,
                                                    start: currentOrTodayShift.start_time_utc,
                                                    end: currentOrTodayShift.end_time_utc,
                                                    workgroup_id: (currentOrTodayShift as { workgroup_id?: number | null }).workgroup_id ?? null,
                                                    workgroup_name: currentOrTodayShift.workgroup_name,
                                                    is_training: (currentOrTodayShift as { is_training?: boolean }).is_training ?? false,
                                                    posts: [],
                                                })
                                            }
                                        >
                                            <ArrowLeftRight className="size-3.5 mr-1" />
                                            Post
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950/30"
                                        disabled={findFFLoading}
                                        onClick={() => onFindFFClick(currentOrTodayShift)}
                                    >
                                        <Plane className="size-3.5 mr-1" />
                                        {findFFLoading ? '…' : 'Find FF'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950/30"
                                        onClick={() => {
                                            if (currentOrTodayShift?.start_time_utc) {
                                                const d = currentOrTodayShift.start_time_utc.slice(0, 10);
                                                if (d >= new Date().toISOString().slice(0, 10)) {
                                                    setFfModalDate(d);
                                                    setFfModalStep('before_after');
                                                    setFfModalTimeFrame(null);
                                                    setFfModalPosts([]);
                                                    setFfModalOpen(true);
                                                }
                                            }
                                        }}
                                    >
                                        <Plane className="size-3.5 mr-1" />
                                        Be A FF
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Below: Next shift (or days until next) */}
                        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-3">
                            Next shift
                        </h3>
                        {displayNextShift ? (
                            <>
                                {(() => {
                                    const days = daysUntilShift(displayNextShift.start_time_utc);
                                    const daysLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days until shift`;
                                    const dateStr = (() => {
                                        try {
                                            const d = new Date(displayNextShift.start_time_utc);
                                            return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', day: 'numeric' }).replace(', ', ' ');
                                        } catch {
                                            return displayNextShift.start_time_utc.slice(8, 10);
                                        }
                                    })();
                                    return (
                                        <p className="mt-2 text-sm font-bold text-foreground">
                                            {daysLabel}  {dateStr}
                                        </p>
                                    );
                                })()}
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
                                    {formatTime(displayNextShift.start_time_utc)} – {formatTime(displayNextShift.end_time_utc)}
                                </p>
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
                                                is_training: (displayNextShift as { is_training?: boolean }).is_training ?? false,
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
                                        disabled={findFFLoading}
                                        onClick={() => onFindFFClick(displayNextShift)}
                                    >
                                        <Plane className="size-3.5 mr-1" />
                                        {findFFLoading ? '…' : 'Find FF'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950/30"
                                        onClick={() => {
                                            if (displayNextShift?.start_time_utc) {
                                                const d = displayNextShift.start_time_utc.slice(0, 10);
                                                if (d >= new Date().toISOString().slice(0, 10)) {
                                                    setFfModalDate(d);
                                                    setFfModalStep('before_after');
                                                    setFfModalTimeFrame(null);
                                                    setFfModalPosts([]);
                                                    setFfModalOpen(true);
                                                }
                                            }
                                        }}
                                    >
                                        <Plane className="size-3.5 mr-1" />
                                        Be A FF
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                {nextShift ? (
                                    currentOrTodayShift && nextShift.id === currentOrTodayShift.id ? (
                                        <p className="mt-2 text-xs text-muted-foreground">Next shift is above.</p>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {(() => {
                                                const days = daysUntilShift(nextShift.start_time_utc);
                                                return days === 0 ? 'Today' : days === 1 ? '1 day until next shift' : `${days} days until next shift`;
                                            })()}
                                        </p>
                                    )
                                ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">No upcoming shift</p>
                                )}
                            </>
                        )}
                    </section>
                    {/* Tabs + content: Time off | Available to work | My active posts */}
                    <div className="min-w-0 flex flex-col">
                        <div className="flex gap-1 border-b border-sidebar-border/50 pb-2">
                            <button
                                type="button"
                                className={`rounded px-3 py-1.5 text-sm font-medium ${dashboardLeftTab === 'overview' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setDashboardLeftTab('overview')}
                            >
                                Time off
                            </button>
                            <button
                                type="button"
                                className={`rounded px-3 py-1.5 text-sm font-medium ${dashboardLeftTab === 'time_off' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setDashboardLeftTab('time_off')}
                            >
                                Available to work
                            </button>
                            <button
                                type="button"
                                className={`rounded px-3 py-1.5 text-sm font-medium ${dashboardLeftTab === 'active_posts' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setDashboardLeftTab('active_posts')}
                            >
                                My active posts
                            </button>
                        </div>
                        <div className="min-w-0 flex-1 min-h-0">
                {dashboardLeftTab === 'active_posts' ? (
                <section className="flex min-h-0 flex-col rounded-xl border border-sidebar-border/50 bg-card p-3 shadow-sm min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <ArrowLeftRight className="size-3.5" />
                                My active posts
                            </h3>
                            <p className="mt-1 text-[10px] text-muted-foreground">Active until shift start.</p>
                        </div>
                        {(activePosts.length > 0 || activeLookingForWorkPosts.length > 0) && (
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
                                    <option value="looking_for_work">Looking for work</option>
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
                    {activePosts.length === 0 && activeLookingForWorkPosts.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">No open postings. Post a shift from the calendar to trade, give away, or offer flight following. Or create a Looking for work post.</p>
                    ) : (
                        <div className="mt-2">
                            <div className="h-80 min-w-0 overflow-y-auto rounded-md border border-sidebar-border/30 bg-muted/20 p-2 dark:bg-muted/10">
                                {(() => {
                                    const groups = groupActivePosts(activePosts);
                                    const typeFilter = activePostTypeFilter.trim().toLowerCase();
                                    const search = activePostSearch.trim().toLowerCase();
                                    const showLfw = !typeFilter || typeFilter === 'looking_for_work';
                                    const showSwap = !typeFilter || typeFilter === 'trade' || typeFilter === 'cash' || typeFilter === 'flight_follow';
                                    const filtered = groups.filter((group) => {
                                        if (!showSwap) return false;
                                        if (typeFilter && !group.posts.some((p) => p.type === typeFilter)) return false;
                                        if (!search) return true;
                                        const shortDate = formatShortDate(group.start);
                                        const position = (group.position_name ?? '').toLowerCase();
                                        const deskLabel = group.desk_type ? getDeskTypeLabel(userWorkgroups, group.workgroup_id ?? null, group.desk_type) : '';
                                        return position.includes(search) || shortDate.includes(search) || deskLabel.toLowerCase().includes(search);
                                    });
                                    const filteredLfw = showLfw
                                        ? activeLookingForWorkPosts.filter((p) => {
                                            if (!search) return true;
                                            const shortDate = formatShortDate(p.seeking_date);
                                            return shortDate.includes(search) || (p.notes ?? '').toLowerCase().includes(search);
                                        })
                                        : [];
                                    if (filtered.length === 0 && filteredLfw.length === 0) {
                                        return <p className="py-2 text-xs text-muted-foreground">No posts match the filter.</p>;
                                    }
                                    return (
                                        <ul className="flex flex-wrap gap-2 pr-1">
                                            {filteredLfw.map((p) => (
                                                <li
                                                    key={`lfw-${p.id}`}
                                                    className="flex min-w-[160px] max-w-[280px] flex-1 basis-48 items-start justify-between gap-2 rounded-lg border border-sidebar-border/50 px-2.5 py-2 text-xs"
                                                >
                                                    <div className="min-w-0 flex-1 shrink space-y-1.5">
                                                        <span className="block text-sm font-bold text-foreground">LFW</span>
                                                        <div className="rounded border border-border/60 bg-muted/20 px-1.5 py-1">
                                                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Full shift</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatShortDate(p.seeking_date)}</p>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                                                <span className="inline-flex gap-0.5 rounded bg-green-500/20 px-1 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                                                                    <DollarSign className="size-2.5" /> ${Number(p.seeking_cash ?? 0).toFixed(0)}
                                                                    {p.seeking_obo && ' OBO'}
                                                                </span>
                                                                {p.seeking_desk_types?.length > 0 && (
                                                                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                                                                        {p.seeking_desk_types.join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {p.willing_to_follow && (
                                                            <div className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-1">
                                                                <p className="text-[10px] font-medium uppercase tracking-wider text-purple-700 dark:text-purple-300">Flight following</p>
                                                                <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300 mt-0.5 inline-flex items-center gap-0.5 flex-wrap">
                                                                    <Plane className="size-2.5 shrink-0" />
                                                                    {p.willing_to_follow_time_frame
                                                                        ? (p.willing_to_follow_time_frame === 'before' ? 'Before my shift' : p.willing_to_follow_time_frame === 'after' ? 'After my shift' : 'Any')
                                                                        : (p.willing_to_follow_slots?.length
                                                                            ? p.willing_to_follow_slots.map((s) => s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())).join(', ')
                                                                            : '') + (p.willing_to_follow_custom ? (p.willing_to_follow_slots?.length ? ' · ' : '') + p.willing_to_follow_custom : '') || 'Any'}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {p.notes && (
                                                            <span className="block truncate max-w-full rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title={p.notes}>
                                                                {p.notes}
                                                            </span>
                                                        )}
                                                        {p.pending_offer_count > 0 && (
                                                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                                {p.pending_offer_count} offer{p.pending_offer_count !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 items-start gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-xs"
                                                            onClick={() => setEditLfwPost(p)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            title="Delete post"
                                                            disabled={deletingLfwPostId === p.id}
                                                            onClick={async () => {
                                                                if (!window.confirm('Remove this Looking for work post? Pending offerers will be notified.')) return;
                                                                setDeletingLfwPostId(p.id);
                                                                try {
                                                                    const res = await fetch(`/api/looking-for-work/posts/${p.id}`, {
                                                                        method: 'DELETE',
                                                                        headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                                                        credentials: 'include',
                                                                    });
                                                                    if (res.ok) router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                                } finally {
                                                                    setDeletingLfwPostId(null);
                                                                }
                                                            }}
                                                        >
                                                            {deletingLfwPostId === p.id ? <span className="text-xs">…</span> : <Trash2 className="size-3.5" />}
                                                        </Button>
                                                    </div>
                                                </li>
                                            ))}
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
                                                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                                        (p.type === 'trade' || p.type === 'time_trade')
                                                                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                                            : p.type === 'cash'
                                                                            ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                                                            : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                                    }`}
                                                                >
                                                                    {p.type === 'trade'
                                                                        ? 'Trade'
                                                                        : p.type === 'time_trade'
                                                                        ? 'Time trade'
                                                                        : p.type === 'cash'
                                                                        ? 'Giveaway'
                                                                        : 'Flight following'}
                                                                </span>
                                                            ))}
                                                            {group.within_24h && (
                                                                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-amber-500">
                                                                    Within 24h
                                                                </span>
                                        )}
                                    </div>
                                                        {group.posts.some((p) => p.type === 'time_trade' && (p.preferred_start_times?.length || p.preferred_desk_type)) && (
                                                            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                                                                {group.posts
                                                                    .filter((p) => p.type === 'time_trade')
                                                                    .map((p) => {
                                                                        const parts: string[] = [];
                                                                        if (p.preferred_start_times?.length) {
                                                                            parts.push(p.preferred_start_times.join(', '));
                                                                        }
                                                                        if (p.preferred_desk_type) {
                                                                            const deskLabel = getDeskTypeLabel(userWorkgroups, group.workgroup_id ?? null, p.preferred_desk_type);
                                                                            if (deskLabel) parts.push(deskLabel);
                                                                        }
                                                                        if (parts.length === 0) return null;
                                                                        return (
                                                                            <div key={p.id}>
                                                                                <span className="font-medium">Trying for:</span> {parts.join(' · ')}
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        )}
                                                        {group.posts.some((p) => (p.type === 'trade' || p.type === 'time_trade') && formatPaybackRanges(p.payback_date_ranges)) && (
                                                            <div className="mt-1 text-[10px] text-muted-foreground">
                                                                <span className="font-medium">Payback preferred:</span>{' '}
                                                                {formatPaybackRanges(group.posts.find((p) => (p.type === 'trade' || p.type === 'time_trade') && p.payback_date_ranges?.length)?.payback_date_ranges)}
                                                            </div>
                                                        )}
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
                                                                    is_training: (group as { is_training?: boolean }).is_training ?? false,
                                                                    posts: group.posts.map((p) => ({
                                                                        id: p.id,
                                                                        type: p.type,
                                                                        cash_amount: p.cash_amount ?? null,
                                                                        flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                                        flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                                        notes: p.notes ?? null,
                                                                        preferred_start_times: p.preferred_start_times ?? null,
                                                                        preferred_desk_type: p.preferred_desk_type ?? null,
                                                                        payback_date_ranges: (p as { payback_date_ranges?: { start: string; end: string }[] | null }).payback_date_ranges ?? null,
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
                ) : dashboardLeftTab === 'overview' ? (
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
                                    <p className="text-xs font-bold text-foreground">
                                {selectedRange ? `Shifts of ${formatRangeShort(selectedRange.start_date, selectedRange.end_date)}` : 'Shifts to cover'}
                                    </p>
                            {selectedRange ? (
                                <>
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
                                                                                is_training: ext?.is_training ?? false,
                                                                                posts: (ext?.posts ?? []).map((p) => ({
                                                                                    id: p.id,
                                                                                    type: p.type,
                                                                                    cash_amount: p.cash_amount ?? null,
                                                                                    flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                                                    flight_follow_at: p.flight_follow_at ?? null,
                                                                                    notes: p.notes ?? null,
                                                                                    preferred_start_times: p.preferred_start_times ?? null,
                                                                                    preferred_desk_type: p.preferred_desk_type ?? null,
                                                                                    payback_date_ranges: (p as { payback_date_ranges?: { start: string; end: string }[] | null }).payback_date_ranges ?? null,
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
                                    <p className="mt-1 text-xs text-muted-foreground">Select a date range above to see shifts in that range.</p>
                            )}
                        </div>
                </section>
                ) : (
                <section className="rounded-xl border border-sidebar-border/50 bg-card p-3 shadow-sm min-w-0">
                            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Briefcase className="size-3.5" />
                        Looking for work
                            </h3>
                    <div className="mt-2 space-y-2">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px]">Title for this date range</Label>
                            <Input type="text" placeholder="e.g. March availability" value={bulkLfwRangeTitle} onChange={(e) => setBulkLfwRangeTitle(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px]">Start</Label>
                                <Input type="date" value={bulkLfwFrom} onChange={(e) => { const v = e.target.value; setBulkLfwFrom(v); setBulkLfwTo((p) => (!p || v > p ? v : p)); }} className="h-8 text-xs" min={new Date().toISOString().slice(0, 10)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px]">End</Label>
                                <Input type="date" value={bulkLfwTo} onChange={(e) => setBulkLfwTo(e.target.value)} className="h-8 text-xs" min={bulkLfwFrom || new Date().toISOString().slice(0, 10)} />
                    </div>
                            <div className="flex items-end">
                                <Button size="sm" className="h-8" disabled={!bulkLfwFrom || !bulkLfwTo || addingLfwPuck} onClick={async () => {
                                    if (!bulkLfwFrom || !bulkLfwTo) return;
                                    setAddingLfwPuck(true);
                                    try {
                                        const res = await fetch('/api/lfw-date-ranges', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                            credentials: 'include',
                                            body: JSON.stringify({ title: bulkLfwRangeTitle.trim() || 'LFW', date_from: bulkLfwFrom, date_to: bulkLfwTo }),
                                        });
                                        if (res.ok) {
                                            const data = await res.json();
                                            setRangePucks((prev) => [...prev, { id: data.id, title: data.title, dateFrom: data.dateFrom, dateTo: data.dateTo }]);
                                            setBulkLfwRangeTitle('LFW');
                                            setBulkLfwFrom('');
                                            setBulkLfwTo('');
                                        }
                                    } finally {
                                        setAddingLfwPuck(false);
                                    }
                                }}>{addingLfwPuck ? '…' : 'Add'}</Button>
                            </div>
                        </div>
                    </div>
                    {rangePucks.length > 0 && (
                        <div className="mt-3 max-h-44 overflow-y-auto">
                            <ul className="flex flex-wrap gap-2">
                                {rangePucks.map((puck) => {
                                    const from = new Date(puck.dateFrom + 'T12:00:00Z');
                                    const to = new Date(puck.dateTo + 'T12:00:00Z');
                                    const datesInRange: string[] = [];
                                    for (let t = from.getTime(); t <= to.getTime(); t += 24 * 60 * 60 * 1000) datesInRange.push(new Date(t).toISOString().slice(0, 10));
                                    const offDates = datesInRange.filter((d) => !datesWithShifts.has(d) && d >= new Date().toISOString().slice(0, 10));
                                    const daysOffCount = offDates.length;
                                    const isExpanded = expandedPuckId === puck.id;
                                                return (
                                                    <li
                                            key={puck.id}
                                            className={`flex min-w-0 max-w-[220px] flex-1 basis-40 items-start justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${
                                                isExpanded ? 'border-primary bg-primary/5' : 'border-sidebar-border/50'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 shrink text-left hover:underline"
                                                onClick={() => setExpandedPuckId(isExpanded ? null : puck.id)}
                                            >
                                                <span className="block font-medium">{puck.title}</span>
                                                <span className="block text-muted-foreground">{formatRangeShort(puck.dateFrom, puck.dateTo)} · <span className="font-medium">{daysOffCount} day{daysOffCount !== 1 ? 's' : ''} off</span></span>
                                            </button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                                onClick={async () => {
                                                    if (!window.confirm('Remove this date range?')) return;
                                                    const id = puck.id;
                                                    try {
                                                        const res = await fetch(`/api/lfw-date-ranges/${id}`, {
                                                            method: 'DELETE',
                                                            headers: { 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                                            credentials: 'include',
                                                        });
                                                        if (res.ok) {
                                                            setRangePucks((prev) => prev.filter((p) => p.id !== id));
                                                            if (expandedPuckId === id) setExpandedPuckId(null);
                                                        }
                                                    } catch {
                                                        // ignore
                                                    }
                                                }}
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
                        <p className="text-xs font-bold text-foreground">
                            {expandedPuckId ? (() => {
                                const puck = rangePucks.find((p) => p.id === expandedPuckId);
                                return puck ? `Days of ${formatRangeShort(puck.dateFrom, puck.dateTo)}` : 'Days available to work';
                            })() : 'Days available to work'}
                        </p>
                        {!expandedPuckId ? (
                            <p className="mt-1 text-xs text-muted-foreground">Select a date range above to see days without a shift and post Looking for work.</p>
                        ) : (() => {
                            const puck = rangePucks.find((p) => p.id === expandedPuckId);
                            if (!puck) return null;
                            const from = new Date(puck.dateFrom + 'T12:00:00Z');
                            const to = new Date(puck.dateTo + 'T12:00:00Z');
                            const datesInRange: string[] = [];
                            for (let t = from.getTime(); t <= to.getTime(); t += 24 * 60 * 60 * 1000) datesInRange.push(new Date(t).toISOString().slice(0, 10));
                            const offDates = datesInRange.filter((d) => !datesWithShifts.has(d) && d >= new Date().toISOString().slice(0, 10));
                            return (
                                <>
                                    {offDates.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">No days without a shift in this range (or all in the past).</p>
                                    ) : (
                                        <>
                                            <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto text-xs">
                                                {offDates.map((dateStr) => {
                                                    const existing = activeLookingForWorkPosts.find((p) => p.seeking_date === dateStr);
                                                    return (
                                                        <li key={dateStr} className="flex items-center justify-between gap-2">
                                                            <span className="text-muted-foreground">{dateStr}</span>
                                                            <div className="flex gap-1">
                                                                {existing ? (
                                                                    <>
                                                                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEditLfwPost(existing)}>Edit</Button>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" disabled={deletingLfwPostId === existing.id} onClick={async () => {
                                                                            if (!window.confirm('Remove this Looking for work post?')) return;
                                                                            setDeletingLfwPostId(existing.id);
                                                                            try {
                                                                                const res = await fetch(`/api/looking-for-work/posts/${existing.id}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
                                                                                if (res.ok) router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                                            } finally { setDeletingLfwPostId(null); }
                                                                        }}><Trash2 className="size-3.5" /></Button>
                                                                    </>
                                                                ) : (
                                                                    <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" disabled={postingLfwDate != null} onClick={async () => {
                                                                        setPostingLfwDate(dateStr);
                                                                        try {
                                                                            const res = await fetch('/api/looking-for-work/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ seeking_date: dateStr, seeking_cash: 0, seeking_obo: false, notes: null, seeking_desk_types: null }) });
                                                                            if (res.ok) router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                                        } finally { setPostingLfwDate(null); }
                                                                    }}>{postingLfwDate === dateStr ? '…' : 'Post'}</Button>
                                                                )}
                                                    </div>
                                                </li>
                                                );
                                            })}
                                        </ul>
                                            <Button size="sm" className="mt-2 h-7 w-full" disabled={postingLfwAllPuckId != null || offDates.every((d) => activeLookingForWorkPosts.some((p) => p.seeking_date === d))} onClick={async () => {
                                                const toPost = offDates.filter((d) => !activeLookingForWorkPosts.some((p) => p.seeking_date === d));
                                                if (toPost.length === 0) return;
                                                setPostingLfwAllPuckId(puck.id);
                                                try {
                                                    for (const dateStr of toPost) await fetch('/api/looking-for-work/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ seeking_date: dateStr, seeking_cash: 0, seeking_obo: false, notes: null, seeking_desk_types: null }) });
                                                    router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                } finally { setPostingLfwAllPuckId(null); }
                                            }}>{postingLfwAllPuckId === puck.id ? 'Posting…' : `Post all (${offDates.filter((d) => !activeLookingForWorkPosts.some((p) => p.seeking_date === d)).length} dates)`}</Button>
                                        </>
                                    )}
                                </>
                                    );
                                })()}
                            </div>
                </section>
                )}

                        </div>
                        </div>
                </div>

                {/* Action required — only when someone has responded to your post */}
                {actionRequired.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-muted-foreground">Action required</h2>
                        <ul className="space-y-2">
                            {groupedActionRequired.map(({ single, group }) => {
                                const isLfw = single.action_type === 'looking_for_work_offer';
                                const isMultiLfw = isLfw && group != null && group.length > 1;
                                const isMultiSwap = !isLfw && group != null && group.length > 1;
                                const label = isLfw
                                    ? (isMultiLfw
                                        ? `${group!.length} offers on your Looking for work post${single.seeking_date ? ` (${single.seeking_date})` : ''}`
                                        : `Someone responded to your Looking for work post${single.seeking_date ? ` (${single.seeking_date})` : ''}`)
                                    : (isMultiSwap
                                        ? `${group!.length} people responded to your ${postTypeLabel(single.post_type)}${single.position_name ? ` · ${single.position_name}` : ''}`
                                        : `Someone responded to your ${postTypeLabel(single.post_type)}${single.position_name ? ` · ${single.position_name}` : ''}`);
                                const key = isMultiLfw ? `lfw-post-${single.looking_for_work_post_id}` : isMultiSwap ? `swap-post-${single.swap_post_id}` : (isLfw ? `lfw-${single.id}` : String(single.id));
                                return (
                                <li
                                    key={key}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
                                >
                                    <div>
                                        <p className="font-medium">{label}</p>
                                        {!isLfw && single.start_time_utc && (
                                            <p className="text-sm text-muted-foreground">
                                                {formatCentral(single.start_time_utc)}
                                            </p>
                                        )}
                                        {isLfw && single.seeking_date && (
                                            <p className="text-sm text-muted-foreground">{single.seeking_date}</p>
                                        )}
                                        {!isMultiLfw && !isMultiSwap && single.offered_shift_summary && (isLfw || single.post_type === 'trade' || single.post_type === 'time_trade') && (
                                            <p className="text-xs text-muted-foreground">
                                                Offered: {single.offered_shift_summary}
                                            </p>
                                        )}
                </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (isMultiLfw && group) {
                                                setReviewSwapOfferGroup(null);
                                                setReviewLfwOfferGroup(group);
                                                setReviewOfferItem(group[0]);
                                            } else if (isMultiSwap && group) {
                                                setReviewLfwOfferGroup(null);
                                                setReviewSwapOfferGroup(group);
                                                setReviewOfferItem(group[0]);
                                            } else {
                                                setReviewLfwOfferGroup(null);
                                                setReviewSwapOfferGroup(null);
                                                setReviewOfferItem(single);
                                            }
                                        }}
                                    >
                                        Review
                                    </Button>
                                </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {/* Calendar */}
                <section className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-medium text-muted-foreground">Calendar</h2>
                            {props.lastWorkzoneSyncAt && (
                                <span className="text-xs text-muted-foreground" title="Last import or reconcile">
                                    Last sync: {formatCentral(props.lastWorkzoneSyncAt)}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
                                <RefreshCw className="size-4" />
                                Refresh
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5" asChild>
                                <Link href={importSchedule.url()}>
                                    <Download className="size-4" />
                                    Import
                                </Link>
                            </Button>
                            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddShiftModal(true)}>
                                <Plus className="size-4" />
                                Add Shift
                            </Button>
                        </div>
                    </div>
                    <div className="schedule-calendar relative rounded-xl border border-sidebar-border/70 bg-card p-2 sm:p-4 dark:border-sidebar-border">
                        {calendarEventsLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-[1px]" aria-hidden="true">
                                <span className="text-sm text-muted-foreground">Loading…</span>
                            </div>
                        )}
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            views={{
                                dayGridMonth: {
                                    showNonCurrentDates: true,
                                    fixedWeekCount: true,
                                },
                            }}
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

            <Dialog open={!!modalDate} onOpenChange={(open) => {
                if (!open) {
                    setModalDate(null);
                    setDatePopupPostsOpen(false);
                }
            }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Shifts for {modalDate}</DialogTitle>
                    </DialogHeader>
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
                                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setReviewOfferItem(actionRequiredItem); setModalDate(null); }}>
                                                Respond to offer
                                            </Button>
                                            {posts.length > 0 ? (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setPostModalShift({
                                                        shiftId: ev.extendedProps!.shiftId,
                                                        position_name: positionName,
                                                        desk_type: ev.extendedProps?.desk_type ?? null,
                                                        start: ev.start,
                                                        end: ev.end,
                                                        workgroup_id: ev.extendedProps?.workgroup_id ?? null,
                                                        workgroup_name: ev.extendedProps?.workgroup_name,
                                                        is_training: ev.extendedProps?.is_training ?? false,
                                                        posts: posts.map((p) => ({
                                                            id: p.id,
                                                            type: p.type,
                                                            cash_amount: p.cash_amount ?? null,
                                                            flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                            flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                            notes: p.notes ?? null,
                                                            preferred_start_times: (p as { preferred_start_times?: string[] | null }).preferred_start_times ?? null,
                                                            preferred_desk_type: (p as { preferred_desk_type?: string | null }).preferred_desk_type ?? null,
                                                            payback_date_ranges: (p as { payback_date_ranges?: { start: string; end: string }[] | null }).payback_date_ranges ?? null,
                                                        })),
                                                    });
                                                    setModalDate(null);
                                                }}>
                                                    Edit post
                                                </Button>
                                            ) : null}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => openEditShiftInDay({ shiftId: ev.extendedProps!.shiftId, position_name: positionName, desk_type: ev.extendedProps?.desk_type ?? null, workgroup_id: ev.extendedProps?.workgroup_id ?? null, workgroup_name: ev.extendedProps?.workgroup_name, start: ev.start, end: ev.end ?? ev.start, regulatory: ev.extendedProps?.regulatory ?? false })}>
                                                        <Pencil className="size-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">Edit shift</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setRemoveShiftConfirm({ shiftId: ev.extendedProps!.shiftId, positionName })}>
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">Remove shift</TooltipContent>
                                            </Tooltip>
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
                                                        is_training: ev.extendedProps?.is_training ?? false,
                                                        posts: posts.map((p) => ({
                                                            id: p.id,
                                                            type: p.type,
                                                            cash_amount: p.cash_amount ?? null,
                                                            flight_follow_minutes: p.flight_follow_minutes ?? null,
                                                            flight_follow_at: (p as { flight_follow_at?: string | null }).flight_follow_at ?? null,
                                                            notes: p.notes ?? null,
                                                            preferred_start_times: (p as { preferred_start_times?: string[] | null }).preferred_start_times ?? null,
                                                            preferred_desk_type: (p as { preferred_desk_type?: string | null }).preferred_desk_type ?? null,
                                                            payback_date_ranges: (p as { payback_date_ranges?: { start: string; end: string }[] | null }).payback_date_ranges ?? null,
                                                        })),
                                                    })
                                                }
                                            >
                                                {posts.length > 0 ? 'Edit post' : 'Post shift'}
                                            </Button>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => openEditShiftInDay({ shiftId: ev.extendedProps!.shiftId, position_name: positionName, desk_type: ev.extendedProps?.desk_type ?? null, workgroup_id: ev.extendedProps?.workgroup_id ?? null, workgroup_name: ev.extendedProps?.workgroup_name, start: ev.start, end: ev.end ?? ev.start, regulatory: ev.extendedProps?.regulatory ?? false })}>
                                                        <Pencil className="size-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">Edit shift</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setRemoveShiftConfirm({ shiftId: ev.extendedProps!.shiftId, positionName })}>
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">Remove shift</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {modalDate && modalDate >= new Date().toISOString().slice(0, 10) && (
                        <Collapsible open={datePopupPostsOpen} onOpenChange={setDatePopupPostsOpen} className="mt-4">
                            <CollapsibleTrigger asChild>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 text-left text-sm font-medium hover:bg-muted/50 dark:border-sidebar-border"
                                >
                                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${datePopupPostsOpen ? 'rotate-90' : ''}`} />
                                    View posts for this date
                                </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <p className="mt-2 mb-2 text-xs text-muted-foreground">Posts you are eligible for (counts shown):</p>
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => {
                                            if (modalDate) {
                                                setLfwModalDate(modalDate);
                                                setLfwModalWilling(false);
                                                setLfwModalOpen(true);
                                                setModalDate(null);
                                            }
                                        }}
                                    >
                                        <Briefcase className="size-3.5 shrink-0" />
                                        Post looking for work
                                    </Button>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </DialogContent>
            </Dialog>

            {/* Find FF: show LFW willing-to-follow for next shift date, or offer to post FF / LFW */}
            <Dialog open={!!findFFModal} onOpenChange={(open) => !open && setFindFFModal(null)}>
                <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plane className="size-5 text-purple-600 dark:text-purple-400" />
                            Flight following
                        </DialogTitle>
                    </DialogHeader>
                    {findFFModal && (
                        <div className="space-y-3">
                            {findFFModal.lfwCount > 0 ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        {findFFModal.lfwCount} {findFFModal.lfwCount === 1 ? 'person is' : 'people are'} willing to follow on {findFFModal.date}. You can offer your shift via Looking for work or view shift-based flight following posts.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="default" size="sm" className="gap-1.5" asChild>
                                            <Link href={`/app/looking-for-work?date_from=${findFFModal.date}&date_to=${findFFModal.date}`} onClick={() => setFindFFModal(null)}>
                                                <Briefcase className="size-3.5 shrink-0" />
                                                View on Looking for work
                                            </Link>
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-1.5 text-purple-600 dark:text-purple-400" asChild>
                                            <Link href={`/app/available?date_from=${findFFModal.date}&date_to=${findFFModal.date}&type=flight_follow`} onClick={() => setFindFFModal(null)}>
                                                <Plane className="size-3.5 shrink-0" />
                                                View shift-based FF
                                            </Link>
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        No active flight followers available for this shift. Post to let people know you are looking for a flight follower.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300"
                                            onClick={() => {
                                                const shift = findFFModal.forShift ?? displayNextShift;
                                                if (shift) {
                                                    setPostModalShift({
                                                        shiftId: shift.id,
                                                        position_name: shift.position_name,
                                                        desk_type: shift.desk_type ?? null,
                                                        start: shift.start_time_utc,
                                                        end: shift.end_time_utc,
                                                        workgroup_id: (shift as { workgroup_id?: number | null }).workgroup_id ?? null,
                                                        workgroup_name: shift.workgroup_name,
                                                        is_training: (shift as { is_training?: boolean }).is_training ?? false,
                                                        posts: [],
                                                        preselectFlightFollow: true,
                                                    });
                                                    setFindFFModal(null);
                                                }
                                            }}
                                        >
                                            <Plane className="size-3.5 shrink-0" />
                                            Post my shift as FF
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* FF modal: before/after shift → show LFW FF posts or offer to post LFW */}
            <Dialog
                open={ffModalOpen}
                onOpenChange={(open) => {
                    if (!open) setFfModalOpen(false);
                }}
            >
                <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plane className="size-5 text-purple-600 dark:text-purple-400" />
                            Flight follower
                        </DialogTitle>
                    </DialogHeader>
                    {ffModalStep === 'before_after' && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Looking for a flight follower before or after your shift?
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={ffModalLoading}
                                    onClick={async () => {
                                        setFfModalTimeFrame('before');
                                        setFfModalLoading(true);
                                        try {
                                            const res = await fetch(
                                                `/api/looking-for-work/posts-for-date?date=${encodeURIComponent(ffModalDate)}&time_frame=before`,
                                                { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' }
                                            );
                                            const data = await res.json().catch(() => ({}));
                                            setFfModalPosts(Array.isArray(data.lfw_ff_posts) ? data.lfw_ff_posts : []);
                                            setFfModalStep('results');
                                        } finally {
                                            setFfModalLoading(false);
                                        }
                                    }}
                                >
                                    Before shift
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={ffModalLoading}
                                    onClick={async () => {
                                        setFfModalTimeFrame('after');
                                        setFfModalLoading(true);
                                        try {
                                            const res = await fetch(
                                                `/api/looking-for-work/posts-for-date?date=${encodeURIComponent(ffModalDate)}&time_frame=after`,
                                                { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' }
                                            );
                                            const data = await res.json().catch(() => ({}));
                                            setFfModalPosts(Array.isArray(data.lfw_ff_posts) ? data.lfw_ff_posts : []);
                                            setFfModalStep('results');
                                        } finally {
                                            setFfModalLoading(false);
                                        }
                                    }}
                                >
                                    After shift
                                </Button>
                            </div>
                        </div>
                    )}
                    {ffModalStep === 'results' && (
                        <div className="space-y-3">
                            {ffModalPosts.length > 0 ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        {ffModalPosts.length} {ffModalPosts.length === 1 ? 'person is' : 'people are'} willing to follow {ffModalTimeFrame === 'before' ? 'before' : 'after'} a shift on {ffModalDate}.
                                    </p>
                                    <Button variant="default" size="sm" className="gap-1.5" asChild>
                                        <Link href={`/app/looking-for-work?date_from=${ffModalDate}&date_to=${ffModalDate}`} onClick={() => setFfModalOpen(false)}>
                                            <Briefcase className="size-3.5 shrink-0" />
                                            View on Looking for work
                                        </Link>
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        No one has posted for this time frame. Would you like to post a Looking for work (willing to follow) for this date?
                                    </p>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => {
                                            setLfwModalDate(ffModalDate);
                                            setLfwModalWilling(true);
                                            setLfwModalTimeFrame(ffModalTimeFrame ?? 'any');
                                            setLfwModalOpen(true);
                                            setFfModalOpen(false);
                                        }}
                                    >
                                        <Briefcase className="size-3.5 shrink-0" />
                                        Post LFW — willing to follow
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => { setFfModalStep('before_after'); setFfModalTimeFrame(null); setFfModalPosts([]); }}>
                                Back
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <PostLfwModal
                open={lfwModalOpen}
                onOpenChange={setLfwModalOpen}
                defaultDate={lfwModalDate || new Date().toISOString().slice(0, 10)}
                defaultWillingToFollow={lfwModalWilling}
                defaultWillingToFollowTimeFrame={lfwModalTimeFrame}
                workgroups={userWorkgroups}
                onSuccess={() => router.reload({ only: DASHBOARD_RELOAD_ONLY })}
            />

            <Dialog open={!!editShiftInDay} onOpenChange={(open) => !open && setEditShiftInDay(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Edit shift</DialogTitle>
                    </DialogHeader>
                    {editShiftInDay && (
                        <>
                            <div className="grid gap-3 pt-2">
                                <div>
                                    <Label htmlFor="edit-shift-workgroup">Workgroup</Label>
                                    <select
                                        id="edit-shift-workgroup"
                                        value={editShiftWorkgroupId}
                                        onChange={(e) => setEditShiftWorkgroupId(e.target.value)}
                                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                    >
                                        <option value="">Select workgroup</option>
                                        {userWorkgroups.map((wg) => (
                                            <option key={wg.id} value={wg.id}>{wg.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="edit-shift-position">Position / desk name</Label>
                                    <Input
                                        id="edit-shift-position"
                                        value={editShiftPositionName}
                                        onChange={(e) => setEditShiftPositionName(e.target.value)}
                                        className="mt-1"
                                        placeholder="e.g. Desk 1, G2"
                                    />
                                </div>
                                {(() => {
                                    const wg = editShiftWorkgroupId ? userWorkgroups.find((w) => w.id === parseInt(editShiftWorkgroupId, 10)) : null;
                                    const deskTypes = wg?.desk_types ?? [];
                                    if (deskTypes.length === 0) return null;
                                    return (
                                        <div>
                                            <Label htmlFor="edit-shift-desk-type">Desk type</Label>
                                            <select
                                                id="edit-shift-desk-type"
                                                value={editShiftDeskType}
                                                onChange={(e) => setEditShiftDeskType(e.target.value)}
                                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                <option value="">—</option>
                                                {deskTypes.map((d) => (
                                                    <option key={d.code} value={d.code}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="edit-shift-date">Start date</Label>
                                        <Input id="edit-shift-date" type="date" value={editShiftDate} onChange={(e) => setEditShiftDate(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="edit-shift-time">Start time</Label>
                                        <Input id="edit-shift-time" type="time" value={editShiftTime} onChange={(e) => setEditShiftTime(e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="edit-shift-nonstandard"
                                        checked={editShiftNonStandard}
                                        onCheckedChange={(c) => setEditShiftNonStandard(!!c)}
                                    />
                                    <Label htmlFor="edit-shift-nonstandard" className="text-sm font-normal">Non-standard end time</Label>
                                </div>
                                {editShiftNonStandard && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="edit-shift-end-date">End date</Label>
                                            <Input id="edit-shift-end-date" type="date" value={editShiftEndDate} onChange={(e) => setEditShiftEndDate(e.target.value)} className="mt-1" />
                                        </div>
                                        <div>
                                            <Label htmlFor="edit-shift-end-time">End time</Label>
                                            <Input id="edit-shift-end-time" type="time" value={editShiftEndTime} onChange={(e) => setEditShiftEndTime(e.target.value)} className="mt-1" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="edit-shift-regulatory"
                                        checked={editShiftRegulatory}
                                        onCheckedChange={(c) => setEditShiftRegulatory(!!c)}
                                    />
                                    <Label htmlFor="edit-shift-regulatory" className="text-sm font-normal">Regulatory</Label>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditShiftInDay(null)}>Cancel</Button>
                                <Button type="button" onClick={saveEditShiftInDay} disabled={editShiftSaving || !editShiftDate || !editShiftPositionName.trim()}>
                                    {editShiftSaving ? 'Saving…' : 'Save'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!removeShiftConfirm} onOpenChange={(open) => !open && setRemoveShiftConfirm(null)}>
                <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Remove shift from schedule?</DialogTitle>
                    </DialogHeader>
                    {removeShiftConfirm && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                This will permanently remove <strong>{removeShiftConfirm.positionName}</strong> from your calendar. Any postings for this shift will also be removed. This cannot be undone.
                            </p>
                            <DialogFooter className="gap-2 pt-4">
                                <Button variant="outline" onClick={() => setRemoveShiftConfirm(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={confirmRemoveShiftInDay} disabled={removeShiftDeleting}>
                                    {removeShiftDeleting ? 'Removing…' : 'Remove shift'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
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
                        is_training: postModalShift.is_training,
                    }}
                    allowedStartTimes={postModalShift.workgroup_id != null ? (userWorkgroups.find((w) => w.id === postModalShift.workgroup_id)?.allowed_start_times ?? []) : []}
                    workgroups={userWorkgroups}
                    existingPosts={postModalShift.posts}
                    preselectFlightFollow={postModalShift.preselectFlightFollow}
                    onSuccess={handlePostSuccess}
                />
            )}

            <Dialog
                open={reviewOfferItem != null || (reviewLfwOfferGroup != null && reviewLfwOfferGroup.length > 0) || (reviewSwapOfferGroup != null && reviewSwapOfferGroup.length > 0)}
                onOpenChange={(open) => {
                    if (!open) {
                        setReviewOfferItem(null);
                        setReviewLfwOfferGroup(null);
                        setReviewSwapOfferGroup(null);
                        setReviewSelectedShiftId(null);
                        setReviewHideNeedOff(false);
                        setOfferRespondError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden" aria-describedby={undefined}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Review response</DialogTitle>
                        <p className="text-sm font-normal text-muted-foreground">
                            Accept only once the proper positive contact has been made and the change in workzone has been input.
                        </p>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                    {reviewLfwOfferGroup && reviewLfwOfferGroup.length > 0 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                    {reviewLfwOfferGroup[0].seeking_date && `Date you wanted to work: ${reviewLfwOfferGroup[0].seeking_date}. `}
                                    {reviewLfwOfferGroup[0].seeking_obo
                                        ? 'You asked for or best offer (OBO). '
                                        : reviewLfwOfferGroup[0].seeking_cash != null && reviewLfwOfferGroup[0].seeking_cash > 0
                                          ? `You asked for $${Number(reviewLfwOfferGroup[0].seeking_cash).toFixed(0)} cash. `
                                          : ''}
                                    Choose one offer to accept or decline each.
                                </p>
                                {(() => {
                                    const desks = reviewLfwOfferGroup[0].seeking_desk_types?.filter(Boolean) ?? [];
                                    return desks.length > 0 ? (
                                        <p>
                                            <span className="font-medium text-foreground">Desk types: </span>
                                            {desks.join(', ')}
                                        </p>
                                    ) : null;
                                })()}
                                {reviewLfwOfferGroup[0].post_notes && (
                                    <div className="rounded border border-border/70 bg-muted/30 p-2 text-sm">
                                        <span className="font-medium text-foreground">Your post notes: </span>
                                        <p className="mt-0.5 whitespace-pre-wrap">{reviewLfwOfferGroup[0].post_notes}</p>
                                    </div>
                                )}
                            </div>
                            <ul className="space-y-3">
                                {[...reviewLfwOfferGroup]
                                    .sort((a, b) => (a.offer_created_at ?? '').localeCompare(b.offer_created_at ?? ''))
                                    .map((item) => (
                                    <li key={item.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                        <p className="font-medium">{item.offered_by_name ?? 'Someone'}</p>
                                        {item.offered_shift_summary && (
                                            <p className="mt-0.5 text-muted-foreground">Offered: {item.offered_shift_summary}</p>
                                        )}
                                        {item.counter_cash_amount != null && Number(item.counter_cash_amount) > 0 && (
                                            <p className="mt-1 text-sm font-medium text-green-700 dark:text-green-300">
                                                {item.seeking_obo ? 'Cash offer (OBO): ' : 'Counter offer: '}
                                                ${Number(item.counter_cash_amount).toFixed(0)}
                                                {item.seeking_obo ? (
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(their bid)</span>
                                                ) : (
                                                    item.cash_amount != null &&
                                                    Number(item.counter_cash_amount) > Number(item.cash_amount) && (
                                                        <span className="ml-1 text-xs font-normal text-muted-foreground">(more than your ask)</span>
                                                    )
                                                )}
                                            </p>
                                        )}
                                        {item.offered_by_contact && (
                                            <p className="mt-1 text-xs">
                                                <span className="font-medium text-foreground">Contact: </span>
                                                <span className="text-muted-foreground">{item.offered_by_contact}</span>
                                            </p>
                                        )}
                                        {item.response_notes && (
                                            <p className="mt-1 text-xs text-muted-foreground">Notes: {item.response_notes}</p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={async () => {
                                                    setOfferRespondError(null);
                                                    setOfferResponding('reject');
                                                    try {
                                                        const res = await fetch(`/api/looking-for-work/offers/${item.id}/reject`, {
                                                            method: 'POST',
                                                            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                                            credentials: 'include',
                                                        });
                                                        if (res.ok) {
                                                            const next = reviewLfwOfferGroup?.filter((o) => o.id !== item.id) ?? [];
                                                            setReviewLfwOfferGroup(next.length > 0 ? next : null);
                                                            if (next.length === 0) setReviewOfferItem(null);
                                                            router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                        }
                                                    } finally {
                                                        setOfferResponding(null);
                                                    }
                                                }}
                                                disabled={offerResponding != null}
                                            >
                                                {offerResponding === 'reject' ? 'Declining…' : 'Decline'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={() => item && handleRespondToOffer(item, 'accept')}
                                                disabled={offerResponding != null}
                                            >
                                                {offerResponding === 'accept' ? 'Accepting…' : 'Accept'}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {offerRespondError && <p className="text-sm text-destructive">{offerRespondError}</p>}
                        </div>
                    ) : reviewSwapOfferGroup && reviewSwapOfferGroup.length > 0 ? (() => {
                        const posterShiftDates = new Set(
                            events.filter((ev) => ev.extendedProps?.shiftId).map((ev) => ev.start.slice(0, 10))
                        );
                        const postedShiftDate = reviewSwapOfferGroup[0]?.start_time_utc?.slice(0, 10) ?? null;
                        const paybackRangesStr = formatPaybackRanges(reviewSwapOfferGroup[0]?.payback_date_ranges);
                        const selectedCombined = reviewSelectedCombinedShift && combinedOfferedShifts.some(
                            (r) => r.offerId === reviewSelectedCombinedShift.offerId && r.shiftId === reviewSelectedCombinedShift.shiftId
                        ) ? reviewSelectedCombinedShift : (combinedOfferedShifts[0] ? { offerId: combinedOfferedShifts[0].offerId, shiftId: combinedOfferedShifts[0].shiftId } : null);
                        const selectedOffer = selectedCombined ? reviewSwapOfferGroup.find((o) => o.id === selectedCombined.offerId) : null;
                        return (
                        <div className="space-y-4 py-2">
                            <p className="text-sm text-muted-foreground">
                                {reviewSwapOfferGroup[0].position_name && `${reviewSwapOfferGroup[0].position_name} · `}
                                {reviewSwapOfferGroup[0].start_time_utc && `${formatCentral(reviewSwapOfferGroup[0].start_time_utc)}. `}
                                Select one shift to accept. Each shift shows who offered it.
                            </p>
                            {reviewSwapOfferGroup[0].post_notes && (
                                <div className="rounded border border-border/70 bg-muted/30 p-2 text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">Your post notes: </span>
                                    <p className="mt-0.5 whitespace-pre-wrap">{reviewSwapOfferGroup[0].post_notes}</p>
                                </div>
                            )}
                            {paybackRangesStr && (
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Your payback preferred:</span> {paybackRangesStr}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4">
                                {timeOffRanges.length > 0 && (
                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={reviewHideNeedOff}
                                            onChange={(e) => setReviewHideNeedOff(e.target.checked)}
                                            className="h-4 w-4 rounded border-input"
                                        />
                                        <span>Hide shifts on dates I need off</span>
                                    </label>
                                )}
                                {paybackRangesStr && (
                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={reviewOnlyPaybackRange}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setReviewOnlyPaybackRange(checked);
                                                if (checked && selectedCombined) {
                                                    const selectedRow = combinedOfferedShifts.find(
                                                        (r) => r.offerId === selectedCombined.offerId && r.shiftId === selectedCombined.shiftId
                                                    );
                                                    if (selectedRow?.in_payback_range !== true) {
                                                        const firstInRange = combinedOfferedShifts.find((r) => r.in_payback_range === true);
                                                        if (firstInRange) {
                                                            setReviewSelectedCombinedShift({ offerId: firstInRange.offerId, shiftId: firstInRange.shiftId });
                                                        }
                                                    }
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-input"
                                        />
                                        <span>Only show shifts in my payback range</span>
                                    </label>
                                )}
                            </div>
                            {visibleCombinedShifts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {reviewHideNeedOff
                                        ? 'All offered shifts are on days you need off. Turn off the filter above to see them.'
                                        : reviewOnlyPaybackRange
                                          ? 'No offered shifts fall in your payback range. Turn off the filter to see all.'
                                          : 'No shifts to show.'}
                                </p>
                            ) : (
                            <ul className="space-y-1.5">
                                {visibleCombinedShifts.map((row) => {
                                    const offerDate = row.start_time_utc?.slice(0, 10) ?? '';
                                    const shiftDatesAfterAccept = new Set(posterShiftDates);
                                    if (postedShiftDate) shiftDatesAfterAccept.delete(postedShiftDate);
                                    if (offerDate) shiftDatesAfterAccept.add(offerDate);
                                    const { daysOffBefore, daysOffAfter } = offerDate ? getDaysOffBeforeAfter(offerDate, shiftDatesAfterAccept) : { daysOffBefore: 0, daysOffAfter: 0 };
                                    const inTimeOff = offerDate ? isDateInTimeOffRanges(offerDate, timeOffRanges) : false;
                                    const wouldBeDouble = Boolean(offerDate && offerDate !== postedShiftDate && posterShiftDates.has(offerDate));
                                    const consecutiveWorkDays = offerDate ? getConsecutiveWorkDaysIncluding(offerDate, shiftDatesAfterAccept) : 0;
                                    const isSelected = selectedCombined?.offerId === row.offerId && selectedCombined?.shiftId === row.shiftId;
                                    return (
                                        <li key={`${row.offerId}-${row.shiftId}`}>
                                            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                                <input
                                                    type="radio"
                                                    name="review-combined-shift"
                                                    checked={isSelected}
                                                    onChange={() => setReviewSelectedCombinedShift({ offerId: row.offerId, shiftId: row.shiftId })}
                                                    className="mt-1 h-4 w-4 shrink-0 border-input"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-medium">{row.position_name}</span>
                                                        <span className="text-muted-foreground text-xs">{formatCentral(row.start_time_utc)}</span>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {row.offeredByName} — Offer #{row.preferenceOrder}
                                                    </p>
                                                    {row.counter_cash_amount != null && Number(row.counter_cash_amount) > 0 && (
                                                        <p className="mt-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                                                            Counter offer: ${Number(row.counter_cash_amount).toFixed(0)}
                                                        </p>
                                                    )}
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {row.in_payback_range === true && (
                                                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">In payback range</span>
                                                        )}
                                                        {row.in_payback_range === false && (
                                                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">Outside payback range</span>
                                                        )}
                                                        {daysOffBefore > 0 && daysOffAfter > 0 ? (
                                                            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                Middle of days off
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {daysOffBefore > 0 && (
                                                                    <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                        {daysOffBefore === 1 ? '1 day off before' : `${daysOffBefore} days off before`}
                                                                    </span>
                                                                )}
                                                                {daysOffAfter > 0 && (
                                                                    <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                        {daysOffAfter === 1 ? '1 day off after' : `${daysOffAfter} days off after`}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        {inTimeOff && (
                                                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">Need off</span>
                                                        )}
                                                        {wouldBeDouble && (
                                                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Double</span>
                                                        )}
                                                        {consecutiveWorkDays >= 6 && (
                                                            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                {consecutiveWorkDays} day work week
                                                            </span>
                                                        )}
                                                    </div>
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                            )}
                            {offerRespondError && <p className="text-sm text-destructive">{offerRespondError}</p>}
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                                <div className="flex flex-wrap gap-1.5">
                                    {reviewSwapOfferGroup.map((item) => (
                                        <Button
                                            key={item.id}
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                            onClick={async () => {
                                                setOfferRespondError(null);
                                                setOfferResponding('reject');
                                                try {
                                                    const res = await fetch(`/api/offers/${item.id}/reject`, {
                                                        method: 'POST',
                                                        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                                        credentials: 'include',
                                                    });
                                                    if (res.ok) {
                                                        const next = reviewSwapOfferGroup.filter((o) => o.id !== item.id);
                                                        setReviewSwapOfferGroup(next.length > 0 ? next : null);
                                                        if (next.length === 0) setReviewOfferItem(null);
                                                        router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                                    }
                                                } finally {
                                                    setOfferResponding(null);
                                                }
                                            }}
                                            disabled={offerResponding != null}
                                        >
                                            Decline {item.offered_by_name ?? 'response'}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={!selectedOffer || offerResponding != null}
                                    onClick={() => selectedOffer && selectedCombined && handleRespondToOffer(selectedOffer, 'accept', selectedCombined.shiftId)}
                                >
                                    {offerResponding === 'accept' ? 'Accepting…' : 'Accept selected'}
                                </Button>
                            </div>
                        </div>
                        );
                    })() : reviewOfferItem ? (() => {
                        const isLfw = reviewOfferItem.action_type === 'looking_for_work_offer';
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
                                    {isLfw && `${offererName} offered a shift for your Looking for work post${reviewOfferItem.seeking_date ? ` (${reviewOfferItem.seeking_date})` : ''}`}
                                    {isCash && !isLfw && `${offererName} wants your shift${cashLabel}`}
                                    {isTrade && (offeredShifts.length > 0
                                        ? `${offererName} offered these days in exchange for working the posted shift`
                                        : `${offererName} offered a trade`)}
                                    {isFlightFollow && `${offererName} responded to your flight following`}
                                    {!isLfw && !isCash && !isTrade && !isFlightFollow && `${offererName} responded to your ${postTypeLabel(reviewOfferItem.post_type)}`}
                                    {!isLfw && reviewOfferItem.position_name && ` · ${reviewOfferItem.position_name}`}
                                </p>
                                {reviewOfferItem.start_time_utc && (
                                    <p className="mt-1 text-muted-foreground">{formatCentral(reviewOfferItem.start_time_utc)}</p>
                                )}
                                {formatPaybackRanges(reviewOfferItem.payback_date_ranges) && (
                                    <p className="mt-1 text-muted-foreground">
                                        <span className="font-medium">Your payback preferred:</span> {formatPaybackRanges(reviewOfferItem.payback_date_ranges)}
                                    </p>
                                )}
                                {isLfw && reviewOfferItem.seeking_date && (
                                    <p className="mt-1 text-muted-foreground">Date you wanted to work: {reviewOfferItem.seeking_date}</p>
                                )}
                                {isLfw && (reviewOfferItem.seeking_desk_types?.filter(Boolean).length ?? 0) > 0 && (
                                    <p className="mt-1 text-muted-foreground">
                                        <span className="font-medium text-foreground">Desk types: </span>
                                        {reviewOfferItem.seeking_desk_types!.filter(Boolean).join(', ')}
                                    </p>
                                )}
                                {reviewOfferItem.post_notes && (
                                    <div className="mt-2 rounded border border-border/70 bg-muted/30 p-2 text-sm">
                                        <span className="font-medium text-foreground">Your post notes: </span>
                                        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{reviewOfferItem.post_notes}</p>
                                    </div>
                                )}
                                {(isLfw && reviewOfferItem.offered_shift_summary) || (isTrade && offeredShifts.length === 0 && reviewOfferItem.offered_shift_summary) ? (
                                    <p className="mt-1 text-muted-foreground">Offered: {reviewOfferItem.offered_shift_summary}</p>
                                ) : null}
                                {reviewOfferItem.counter_cash_amount != null && Number(reviewOfferItem.counter_cash_amount) > 0 && (
                                    <p className="mt-1.5 text-sm font-medium text-green-700 dark:text-green-300">
                                        {isLfw && reviewOfferItem.seeking_obo ? (
                                            <>
                                                Cash offer (OBO): ${Number(reviewOfferItem.counter_cash_amount).toFixed(0)}
                                                <span className="ml-1 font-normal text-muted-foreground">(their bid)</span>
                                            </>
                                        ) : (
                                            <>
                                                Counter offer: ${Number(reviewOfferItem.counter_cash_amount).toFixed(0)}
                                                {reviewOfferItem.cash_amount != null &&
                                                    Number(reviewOfferItem.counter_cash_amount) > Number(reviewOfferItem.cash_amount) && (
                                                        <span className="ml-1 font-normal text-muted-foreground">(more than your ask)</span>
                                                    )}
                                            </>
                                        )}
                                    </p>
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
                                            <span>Hide shifts on dates I need off</span>
                                        </label>
                                    )}
                                    <p className="text-sm font-medium">Select which shift to accept (responder’s offer order):</p>
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
                                            const consecutiveWorkDays = offerDate ? getConsecutiveWorkDaysIncluding(offerDate, shiftDatesAfterAccept) : 0;
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
                                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                                            — Offer #{idx + 1}
                                                        </span>
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {s.in_payback_range === true && (
                                                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                                                    In payback range
                                                                </span>
                                                            )}
                                                            {s.in_payback_range === false && (
                                                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                                                                    Outside payback range
                                                                </span>
                                                            )}
                                                            {daysOffBefore > 0 && daysOffAfter > 0 ? (
                                                                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                    Middle of days off
                                                                </span>
                                                            ) : (
                                                                <>
                                                            {daysOffBefore > 0 && (
                                                                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                    {daysOffBefore === 1 ? '1 day off before' : `${daysOffBefore} days off before`}
                                                                </span>
                                                            )}
                                                            {daysOffAfter > 0 && (
                                                                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                    {daysOffAfter === 1 ? '1 day off after' : `${daysOffAfter} days off after`}
                                                                </span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {inTimeOff && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 cursor-help">
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
                                                            {consecutiveWorkDays >= 6 && (
                                                                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
                                                                    {consecutiveWorkDays} day work week
                                                                </span>
                                                            )}
                                                        </div>
                                                    </span>
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
                                    onClick={() => reviewOfferItem && handleRespondToOffer(reviewOfferItem, 'reject')}
                                    disabled={offerResponding != null}
                                >
                                    {offerResponding === 'reject' ? 'Declining…' : 'Decline'}
                                </Button>
                                <Button
                                    onClick={() => reviewOfferItem && handleRespondToOffer(reviewOfferItem, 'accept', isTrade && offeredShifts.length > 0 ? (selectedId ?? undefined) : undefined)}
                                    disabled={offerResponding != null}
                                >
                                    {offerResponding === 'accept' ? 'Accepting…' : 'Accept'}
                                </Button>
                            </div>
                        </div>
                        );
                    })() : null}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Looking for work post */}
            <Dialog open={!!editLfwPost} onOpenChange={(open) => !open && setEditLfwPost(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Looking for work post</DialogTitle>
                    </DialogHeader>
                    {editLfwPost && editLfwForm && (
                        <div className="space-y-4 py-2">
                            <div>
                                <Label className="text-xs">Date you want to work</Label>
                                <Input
                                    type="date"
                                    value={editLfwForm.date}
                                    onChange={(e) => setEditLfwForm((f) => f ? { ...f, date: e.target.value } : null)}
                                    className="mt-1 h-8 text-sm"
                                    min={new Date().toISOString().slice(0, 10)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Cash ($)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={editLfwForm.cash}
                                    onChange={(e) => setEditLfwForm((f) => f ? { ...f, cash: e.target.value } : null)}
                                    className="mt-1 h-8 text-sm"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={editLfwForm.obo}
                                    onChange={(e) => setEditLfwForm((f) => f ? { ...f, obo: e.target.checked } : null)}
                                    className="h-4 w-4 rounded border-input"
                                />
                                <span>Or best offer (OBO)</span>
                            </label>
                            <div>
                                <Label className="text-xs">Desk types (optional)</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {((): { code: string; label: string }[] => {
                                        const m = new Map<string, { code: string; label: string }>();
                                        for (const w of userWorkgroups) {
                                            for (const d of w.desk_types ?? []) {
                                                if (!m.has(d.code)) m.set(d.code, d);
                                            }
                                        }
                                        return [...m.values()];
                                    })().map((dt) => (
                                        <label key={dt.code} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={editLfwForm.deskTypes.includes(dt.code)}
                                                onChange={(e) => setEditLfwForm((f) => {
                                                    if (!f) return null;
                                                    const next = e.target.checked
                                                        ? [...f.deskTypes, dt.code]
                                                        : f.deskTypes.filter((c) => c !== dt.code);
                                                    return { ...f, deskTypes: next };
                                                })}
                                                className="h-4 w-4 rounded border-input"
                                            />
                                            <span>{dt.label || dt.code}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Notes (optional)</Label>
                                <Input
                                    value={editLfwForm.notes}
                                    onChange={(e) => setEditLfwForm((f) => f ? { ...f, notes: e.target.value } : null)}
                                    className="mt-1 h-8 text-sm"
                                    placeholder="e.g. prefer morning"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditLfwPost(null)} disabled={editLfwSaving}>
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={editLfwSaving || !editLfwForm.date || editLfwForm.cash === ''}
                                    onClick={async () => {
                                        if (!editLfwPost || !editLfwForm) return;
                                        setEditLfwSaving(true);
                                        try {
                                            const res = await fetch(`/api/looking-for-work/posts/${editLfwPost.id}`, {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Accept': 'application/json',
                                                    'X-XSRF-TOKEN': getCsrfToken(),
                                                    'X-Requested-With': 'XMLHttpRequest',
                                                },
                                                credentials: 'include',
                                                body: JSON.stringify({
                                                    seeking_date: editLfwForm.date,
                                                    seeking_cash: Number(editLfwForm.cash) || 0,
                                                    seeking_obo: editLfwForm.obo,
                                                    seeking_desk_types: editLfwForm.deskTypes.length ? editLfwForm.deskTypes : null,
                                                    notes: editLfwForm.notes || null,
                                                }),
                                            });
                                            if (res.ok) {
                                                setEditLfwPost(null);
                                                router.reload({ only: DASHBOARD_RELOAD_ONLY });
                                            }
                                        } finally {
                                            setEditLfwSaving(false);
                                        }
                                    }}
                                >
                                    {editLfwSaving ? 'Saving…' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    )}
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