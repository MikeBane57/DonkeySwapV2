import { Head, Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, EyeOff, RefreshCw, Search } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/app' },
    { title: 'Available', href: '/app/available' },
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
    workgroupId: number | undefined,
    code: string | null | undefined
): string {
    if (!code) return '';
    const wg = workgroupId != null ? workgroups.find((w) => w.id === workgroupId) : null;
    const label = wg?.desk_types?.find((d) => d.code === code)?.label;
    return label ?? DESK_TYPE_LABELS[code] ?? code;
}

function getCsrfToken(): string {
    const name = 'XSRF-TOKEN=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.startsWith(' ')) c = c.substring(1);
        if (c.indexOf(name) === 0) return decodeURIComponent(c.substring(name.length, c.length));
    }
    return '';
}

function formatCentral(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
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

/** Short summary of a shift for use in "responding to" context (e.g. "Domestic dispatch, Wed, Mar 12, 6:00 AM"). */
function formatShiftSummary(shift: { position_name: string; workgroup_name?: string | null; start_time_utc: string }): string {
    const parts = [shift.position_name];
    if (shift.workgroup_name) parts.push(shift.workgroup_name);
    parts.push(formatCentral(shift.start_time_utc));
    return parts.join(' · ');
}

type ShiftSummary = {
    id: number;
    position_name: string;
    desk_type?: string | null;
    start_time_utc: string;
    end_time_utc: string;
    workgroup_id: number;
    workgroup_name?: string | null;
};

type MyOfferPart = {
    id: number;
    offered_shift_id: number | null;
    offered_shift_preference_order: number[] | null;
};

type PostPart = {
    id: number;
    type: string;
    cash_amount: number | null;
    flight_follow_minutes: number | null;
    flight_follow_at: string | null;
    notes: string | null;
    eligible: boolean | null;
    ineligible_reason: string | null;
    ineligible_reason_detail: string | null;
    would_be_double?: boolean;
    my_offer?: MyOfferPart | null;
};

type AvailableItem = {
    shift: ShiftSummary;
    poster_name: string | null;
    posts: PostPart[];
};

type MyShift = {
    id: number;
    position_name: string;
    desk_type?: string | null;
    start_time_utc: string;
    end_time_utc: string;
    workgroup_name?: string | null;
};

type DeskTypeOption = { value: string; label: string };

type TimeOffRange = { id: number; title?: string | null; start_date: string; end_date: string };

function isDateInTimeOffRanges(dateStr: string, ranges: TimeOffRange[]): boolean {
    if (!ranges.length) return false;
    for (const r of ranges) {
        if (dateStr >= r.start_date && dateStr <= r.end_date) return true;
    }
    return false;
}

function getTimeOffRangeTitleForDate(dateStr: string, ranges: TimeOffRange[]): string | null {
    for (const r of ranges) {
        if (dateStr >= r.start_date && dateStr <= r.end_date) return r.title ?? 'Time off';
    }
    return null;
}

function getMyShiftDates(myShifts: MyShift[]): Set<string> {
    const set = new Set<string>();
    for (const s of myShifts) {
        const d = s.start_time_utc.slice(0, 10);
        if (d) set.add(d);
    }
    return set;
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

export default function AvailablePage() {
    const props = usePage().props as unknown as {
        posts: AvailableItem[];
        workgroups: { id: number; name: string; desk_types?: { code: string; label: string }[] }[];
        deskTypeOptions: DeskTypeOption[];
        deskTypesByWorkgroup: Record<string, string[]>;
        myShifts: MyShift[];
        timeOffRanges?: TimeOffRange[];
        hidden_posts_count?: number;
        hide_posts_that_would_be_double?: boolean;
        filters: {
            workgroup_id?: string;
            date_from?: string;
            date_to?: string;
            type?: string;
            preferred_only?: boolean;
            eligible_only?: boolean;
            desk_type?: string;
            desk_search?: string;
            min_cash?: string;
            hide_during_time_off?: boolean;
        };
    };
    const { posts, workgroups, deskTypeOptions = [], deskTypesByWorkgroup = {}, myShifts, timeOffRanges = [], hidden_posts_count: initialHiddenCount = 0, hide_posts_that_would_be_double = false, filters = {} } = props;
    const [hiddenPostsCount, setHiddenPostsCount] = useState(initialHiddenCount);
    const [hidingPostIds, setHidingPostIds] = useState<number[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const deskTypeOptionsFiltered = useMemo(() => {
        const workgroupId = filters.workgroup_id;
        if (!workgroupId) return deskTypeOptions;
        const allowed = deskTypesByWorkgroup[workgroupId];
        if (!allowed || allowed.length === 0) return deskTypeOptions;
        return deskTypeOptions.filter((opt) => allowed.includes(opt.value));
    }, [deskTypeOptions, deskTypesByWorkgroup, filters.workgroup_id]);

    useEffect(() => {
        const workgroupId = filters.workgroup_id;
        const deskType = filters.desk_type;
        if (!workgroupId || !deskType) return;
        const allowed = deskTypesByWorkgroup[workgroupId];
        if (allowed && allowed.length > 0 && !allowed.includes(deskType)) {
            applyFilters({ desk_type: undefined });
        }
    }, [filters.workgroup_id, filters.desk_type, deskTypesByWorkgroup]);
    const [offerPostId, setOfferPostId] = useState<number | null>(null);
    const [offerShiftIds, setOfferShiftIds] = useState<number[]>([]);
    const [offerResponseNotes, setOfferResponseNotes] = useState('');
    const [offerOnlyNeedOff, setOfferOnlyNeedOff] = useState(false);
    /** When editing an existing response, we withdraw this offer id first then submit the new one. */
    const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
    const [offerSubmitting, setOfferSubmitting] = useState(false);
    const [offerError, setOfferError] = useState<string | null>(null);
    const [withdrawingOfferId, setWithdrawingOfferId] = useState<number | null>(null);
    const [deskSearchLocal, setDeskSearchLocal] = useState(filters.desk_search ?? '');
    const [minCashLocal, setMinCashLocal] = useState(filters.min_cash ?? '');
    const [myShiftSearch, setMyShiftSearch] = useState('');

    useEffect(() => {
        setDeskSearchLocal(filters.desk_search ?? '');
        setMinCashLocal(filters.min_cash ?? '');
    }, [filters.desk_search, filters.min_cash]);
    useEffect(() => {
        setHiddenPostsCount(initialHiddenCount);
    }, [initialHiddenCount]);

    const hidePost = useCallback(async (postId: number) => {
        setHidingPostIds((prev) => [...prev, postId]);
        try {
            const res = await fetch(`/api/posts/${postId}/hide`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
            if (res.ok) {
                setHiddenPostsCount((c) => c + 1);
                router.reload();
            }
        } finally {
            setHidingPostIds((prev) => prev.filter((id) => id !== postId));
        }
    }, []);

    const unhideAll = useCallback(async () => {
        try {
            const res = await fetch('/api/posts/unhide-all', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
            if (res.ok) {
                setHiddenPostsCount(0);
                router.reload();
            }
        } catch {
            // ignore
        }
    }, []);

    const refresh = useCallback(() => {
        const params = { ...filters } as Record<string, string | boolean>;
        if (params.preferred_only === undefined) delete params.preferred_only;
        if (params.eligible_only === undefined) delete params.eligible_only;
        if (params.desk_type === 'all' || params.desk_type === '') delete params.desk_type;
        if (params.desk_search === '') delete params.desk_search;
        if (params.min_cash === '' || params.min_cash === undefined) delete params.min_cash;
        if (params.hide_during_time_off === false) delete params.hide_during_time_off;
        router.get('/app/available', params, { preserveState: true });
    }, [filters]);

    useEffect(() => {
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    const applyFilters = (updates: Partial<typeof filters>) => {
        const next = { ...filters, ...updates };
        if (next.preferred_only === undefined) delete next.preferred_only;
        if (next.eligible_only === undefined) delete next.eligible_only;
        if (next.desk_type === 'all' || next.desk_type === '') delete next.desk_type;
        if (next.desk_search === '') delete next.desk_search;
        if (next.min_cash === '' || next.min_cash === undefined) delete next.min_cash;
        if (next.hide_during_time_off === false) delete next.hide_during_time_off;
        router.get('/app/available', next as Record<string, string | boolean>, { preserveState: true });
    };

    const offerPost = useMemo(() => {
        if (offerPostId == null) return null;
        for (const item of posts) {
            const p = item.posts.find((po) => po.id === offerPostId);
            if (p) return { ...p, shift: item.shift, poster_name: item.poster_name };
        }
        return null;
    }, [posts, offerPostId]);
    const isOfferTrade = offerPost?.type === 'trade' || offerPost?.type === 'time_trade';

    const myShiftDates = useMemo(() => getMyShiftDates(myShifts), [myShifts]);
    const filteredMyShifts = useMemo(() => {
        let list = myShifts;
        const postStart = offerPost?.type === 'time_trade' ? offerPost?.shift?.start_time_utc : null;
        if (postStart) {
            const postDate = postStart.slice(0, 10);
            list = list.filter((s) => s.start_time_utc.slice(0, 10) === postDate);
        }
        const q = myShiftSearch.trim().toLowerCase();
        let out = list;
        if (q) {
            out = out.filter((s) => {
                const pos = (s.position_name ?? '').toLowerCase();
                const wg = (s.workgroup_name ?? '').toLowerCase();
                const date = s.start_time_utc.slice(0, 10);
                return pos.includes(q) || wg.includes(q) || date.includes(q);
            });
        }
        if (offerOnlyNeedOff && timeOffRanges.length > 0) {
            out = out.filter((s) => isDateInTimeOffRanges(s.start_time_utc.slice(0, 10), timeOffRanges));
        }
        return out;
    }, [myShifts, myShiftSearch, offerPost?.type, offerPost?.shift?.start_time_utc, offerOnlyNeedOff, timeOffRanges]);
    const selectedMyShiftsOrdered = useMemo(() => {
        const byId = new Map(myShifts.map((s) => [s.id, s]));
        return offerShiftIds.map((id) => byId.get(id)).filter(Boolean) as MyShift[];
    }, [myShifts, offerShiftIds]);

    const toggleShiftInOffer = (shiftId: number) => {
        setOfferShiftIds((prev) =>
            prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
        );
    };
    const moveSelected = (index: number, dir: 'up' | 'down') => {
        const next = [...offerShiftIds];
        const j = dir === 'up' ? index - 1 : index + 1;
        if (j < 0 || j >= next.length) return;
        [next[index], next[j]] = [next[j], next[index]];
        setOfferShiftIds(next);
    };

    const submitOffer = async () => {
        if (offerPostId == null) return;
        if (isOfferTrade && offerShiftIds.length === 0) return;
        setOfferError(null);
        setOfferSubmitting(true);
        try {
            if (editingOfferId != null) {
                const withdrawRes = await fetch(`/api/offers/${editingOfferId}/withdraw`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'include',
                });
                if (!withdrawRes.ok) {
                    const data = await withdrawRes.json().catch(() => ({}));
                    setOfferError(data.message ?? 'Failed to update. Try cancelling your response first.');
                    return;
                }
            }
            const body: Record<string, unknown> = isOfferTrade ? { offered_shift_ids: offerShiftIds } : {};
            if (offerResponseNotes.trim()) body.response_notes = offerResponseNotes.trim();
            const res = await fetch(`/api/posts/${offerPostId}/offer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setOfferPostId(null);
                setOfferShiftIds([]);
                setEditingOfferId(null);
                setMyShiftSearch('');
                router.reload();
            } else {
                setOfferError(data.message || data.errors?.offered_shift_ids?.[0] || 'Failed to submit offer.');
            }
        } finally {
            setOfferSubmitting(false);
        }
    };

    const withdrawOffer = async (offerId: number) => {
        setWithdrawingOfferId(offerId);
        try {
            const res = await fetch(`/api/offers/${offerId}/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
            });
            if (res.ok) router.reload();
        } finally {
            setWithdrawingOfferId(null);
        }
    };

    const typeLabel = (t: string) => {
        if (t === 'trade') return 'Trade';
        if (t === 'time_trade') return 'Time trade';
        if (t === 'cash') return 'Giveaway';
        if (t === 'flight_follow') return 'Flight follow';
        return t;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Available shifts" />
            <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-semibold">Available shifts</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Open swap posts from others. Only shifts you are qualified to work are shown. List updates every 30 seconds.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/app/settings/preferences" className="gap-1.5">Preferences</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>
                <div className="rounded-lg border border-sidebar-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-sidebar-border">
                    <strong className="text-foreground">When you can&apos;t work a shift</strong> we show a reason only for <strong>giveaways</strong> and <strong>flight follow</strong>: &quot;Rest&quot; = not enough rest between that shift and your others; &quot;Duty day&quot; = would exceed max hours that day; &quot;Overlap&quot; = that shift overlaps your schedule too much (or &gt;30 min for non-regulatory). Trade posts are validated when you submit an offer.
                    {hide_posts_that_would_be_double && (
                        <p className="mt-1.5 text-foreground/80">Posts that would be a <strong>double</strong> (two shifts same day) are hidden. Change in <Link href="/app/settings/preferences" className="underline">Preferences</Link> to see them.</p>
                    )}
                </div>

                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="rounded-lg border border-sidebar-border/70 bg-muted/30 dark:border-sidebar-border">
                    <div className="flex w-full items-center gap-2 px-3 py-2">
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg -m-1 p-1"
                            >
                                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
                                Filters
                            </button>
                        </CollapsibleTrigger>
                        {hiddenPostsCount > 0 && (
                            <Button variant="outline" size="sm" onClick={unhideAll} className="ml-auto shrink-0 gap-1.5">
                                <EyeOff className="h-4 w-4" />
                                Show hidden posts ({hiddenPostsCount})
                            </Button>
                        )}
                    </div>
                    <CollapsibleContent>
                <div className="space-y-3 px-3 pb-3 pt-0">
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <Label className="text-xs">Workgroup</Label>
                            <Select
                                value={filters.workgroup_id ?? 'all'}
                                onValueChange={(v) => applyFilters({ workgroup_id: v === 'all' ? undefined : v })}
                            >
                                <SelectTrigger className="h-9 w-40 mt-0.5">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {workgroups.map((wg) => (
                                        <SelectItem key={wg.id} value={String(wg.id)}>{wg.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Type</Label>
                            <Select
                                value={filters.type ?? 'all'}
                                onValueChange={(v) => applyFilters({ type: v === 'all' ? undefined : v })}
                            >
                                <SelectTrigger className="h-9 w-36 mt-0.5">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="trade_cash">Trade / Giveaway</SelectItem>
                                    <SelectItem value="flight_follow">Flight follow</SelectItem>
                                    <SelectItem value="time_trade">Time trade</SelectItem>
                                    <SelectItem value="trade">Trade</SelectItem>
                                    <SelectItem value="cash">Giveaway</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Desk type</Label>
                            <Select
                                value={filters.desk_type ?? 'all'}
                                onValueChange={(v) => applyFilters({ desk_type: v === 'all' ? undefined : v })}
                            >
                                <SelectTrigger className="h-9 w-40 mt-0.5">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {deskTypeOptionsFiltered.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Desk / position</Label>
                            <Input
                                type="text"
                                className="h-9 w-32 mt-0.5"
                                placeholder="e.g. 06, G2"
                                value={deskSearchLocal}
                                onChange={(e) => setDeskSearchLocal(e.target.value)}
                                onBlur={() => applyFilters({ desk_search: deskSearchLocal.trim() || undefined })}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters({ desk_search: deskSearchLocal.trim() || undefined })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Min cash ($)</Label>
                            <Input
                                type="number"
                                min={0}
                                step={1}
                                className="h-9 w-24 mt-0.5"
                                placeholder="0"
                                value={minCashLocal}
                                onChange={(e) => setMinCashLocal(e.target.value)}
                                onBlur={() => applyFilters({ min_cash: minCashLocal || undefined })}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters({ min_cash: minCashLocal || undefined })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">From date</Label>
                            <Input
                                type="date"
                                className="h-9 w-36 mt-0.5"
                                value={filters.date_from ?? ''}
                                onChange={(e) => applyFilters({ date_from: e.target.value || undefined })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">To date</Label>
                            <Input
                                type="date"
                                className="h-9 w-36 mt-0.5"
                                value={filters.date_to ?? ''}
                                onChange={(e) => applyFilters({ date_to: e.target.value || undefined })}
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Posts:</span>
                            <div className="inline-flex rounded-md border border-sidebar-border/70 bg-muted/50 p-0.5 dark:border-sidebar-border">
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ preferred_only: false })}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        filters.preferred_only !== true
                                            ? 'bg-background text-foreground shadow'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    All posts
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ preferred_only: true })}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        filters.preferred_only === true
                                            ? 'bg-background text-foreground shadow'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Preferred only
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Eligible only:</span>
                            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={filters.eligible_only === true}
                                    onChange={(e) => applyFilters({ eligible_only: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <span className="absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
                            </label>
                            <span className="text-xs text-muted-foreground">
                                {filters.eligible_only === true ? 'On' : 'Off'}
                            </span>
                        </div>
                        {timeOffRanges.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Hide on days I need off:</span>
                                <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={filters.hide_during_time_off === true}
                                        onChange={(e) => applyFilters({ hide_during_time_off: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <span className="absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
                                </label>
                                <span className="text-xs text-muted-foreground">
                                    {filters.hide_during_time_off === true ? 'On' : 'Off'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                    </CollapsibleContent>
                </Collapsible>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.length === 0 ? (
                        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No available posts match your filters.</p>
                    ) : (
                        posts.map((item) => {
                            const hasMyResponse = item.posts.some((p) => p.my_offer);
                            return (
                            <div
                                key={item.shift.id}
                                className={`flex flex-col rounded-lg border bg-card p-2.5 dark:border-sidebar-border ${
                                    hasMyResponse ? 'border-2 border-primary dark:border-primary' : 'border border-sidebar-border/70'
                                }`}
                            >
                                <div className="flex flex-1 flex-wrap items-start justify-between gap-1.5">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="truncate text-sm font-medium">{item.shift.position_name}</span>
                                            {item.posts.some((p) => p.would_be_double) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400 cursor-help">
                                                            Double
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        Taking this would give you two shifts on the same day.
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            {item.posts.map((p) => (
                                                <span
                                                    key={p.id}
                                                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                                                        p.type === 'trade' || p.type === 'time_trade'
                                                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                            : p.type === 'cash'
                                                              ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                                              : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                    }`}
                                                >
                                                    {typeLabel(p.type)}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCentral(item.shift.start_time_utc)}
                                            {item.shift.workgroup_name && ` · ${item.shift.workgroup_name}`}
                                        </p>
                                        {item.shift.desk_type && (
                                            <p className="text-xs text-muted-foreground">
                                                {getDeskTypeLabel(workgroups, item.shift.workgroup_id, item.shift.desk_type)}
                                            </p>
                                        )}
                                        {timeOffRanges.length > 0 && (() => {
                                            const title = getTimeOffRangeTitleForDate(item.shift.start_time_utc.slice(0, 10), timeOffRanges);
                                            return title ? (
                                                <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                    This shift is during {title} which you need off.
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                                        {item.posts.some((p) => p.type === 'cash' && p.cash_amount != null && p.cash_amount > 0) && (
                                            <span className="text-base font-bold text-green-600 dark:text-green-400">
                                                ${Number(item.posts.find((p) => p.type === 'cash')?.cash_amount ?? 0).toFixed(0)}
                                            </span>
                                        )}
                                        {item.posts.filter((p) => p.type === 'flight_follow' && p.flight_follow_minutes != null).map((p) => (
                                            <span key={p.id} className="text-xs text-muted-foreground">
                                                {p.flight_follow_minutes}m
                                                {p.flight_follow_at === 'end' ? ' at end' : p.flight_follow_at === 'beginning' ? ' at start' : ''}
                                            </span>
                                        ))}
                                        {item.posts.map((p) => (
                                            p.eligible === false && p.ineligible_reason && (
                                                <Tooltip key={p.id}>
                                                    <TooltipTrigger asChild>
                                                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 cursor-help">
                                                            {typeLabel(p.type)}: {p.ineligible_reason}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        {p.ineligible_reason_detail || p.ineligible_reason}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )
                                        ))}
                                    </div>
                                </div>
                                {item.posts.some((p) => p.notes) && (
                                    <p className="mt-1 text-xs text-muted-foreground" title={item.posts.map((p) => p.notes).filter(Boolean).join(' / ')}>
                                        {item.posts.find((p) => p.notes)?.notes}
                                    </p>
                                )}
                                {item.poster_name && (
                                    <p className="mt-1 text-xs text-muted-foreground">by {item.poster_name}</p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-sidebar-border/50 pt-2 dark:border-sidebar-border">
                                    <div className="flex flex-wrap items-center gap-1">
                                    {item.posts.map((p) => (
                                        <span key={p.id} className="inline-flex items-center gap-1">
                                            {p.my_offer ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            const order = p.my_offer!.offered_shift_preference_order ?? (p.my_offer!.offered_shift_id ? [p.my_offer!.offered_shift_id] : []);
                                                            setOfferPostId(p.id);
                                                            setOfferShiftIds([...order]);
                                                            setOfferResponseNotes((p.my_offer as { response_notes?: string | null } | undefined)?.response_notes ?? '');
                                                            setEditingOfferId(p.my_offer!.id);
                                                            setMyShiftSearch('');
                                                            setOfferError(null);
                                                        }}
                                                    >
                                                        Edit response
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => withdrawOffer(p.my_offer!.id)}
                                                        disabled={withdrawingOfferId === p.my_offer!.id}
                                                    >
                                                        {withdrawingOfferId === p.my_offer!.id ? 'Cancelling…' : 'Cancel response'}
                                                    </Button>
                                                </>
                                            ) : p.type === 'trade' ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setOfferPostId(p.id);
                                                        setOfferShiftIds([]);
                                                        setOfferResponseNotes('');
                                                        setEditingOfferId(null);
                                                        setMyShiftSearch('');
                                                        setOfferError(null);
                                                    }}
                                                >
                                                    Respond to trade
                                                </Button>
                                            ) : p.type === 'time_trade' ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setOfferPostId(p.id);
                                                        setOfferShiftIds([]);
                                                        setOfferResponseNotes('');
                                                        setEditingOfferId(null);
                                                        setMyShiftSearch('');
                                                        setOfferError(null);
                                                    }}
                                                >
                                                    Respond to time trade
                                                </Button>
                                            ) : null}
                                            {p.type === 'cash' && !p.my_offer && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setOfferPostId(p.id);
                                                        setOfferShiftIds([]);
                                                        setOfferResponseNotes('');
                                                        setEditingOfferId(null);
                                                        setOfferError(null);
                                                    }}
                                                >
                                                    Take giveaway
                                                </Button>
                                            )}
                                            {p.type === 'flight_follow' && !p.my_offer && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setOfferPostId(p.id);
                                                        setOfferShiftIds([]);
                                                        setOfferResponseNotes('');
                                                        setEditingOfferId(null);
                                                        setOfferError(null);
                                                    }}
                                                >
                                                    Take flight follow
                                                </Button>
                                            )}
                                        </span>
                                    ))}
                                </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={() => {
                                            const ids = item.posts.map((p) => p.id);
                                            const anyHiding = ids.some((id) => hidingPostIds.includes(id));
                                            if (!anyHiding) ids.forEach((id) => hidePost(id));
                                        }}
                                        disabled={item.posts.some((p) => hidingPostIds.includes(p.id))}
                                        title="Hide this listing"
                                    >
                                        <EyeOff className="h-3.5 w-3.5 mr-1" />
                                        Hide
                                    </Button>
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>

            <Dialog open={offerPostId != null} onOpenChange={(open) => { if (!open) { setOfferPostId(null); setEditingOfferId(null); setOfferResponseNotes(''); setOfferOnlyNeedOff(false); } }}>
                <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                        <DialogTitle>
                            {editingOfferId != null
                                ? 'Edit your response'
                                : offerPost?.type === 'time_trade'
                                  ? (offerPost?.shift ? `Offer a shift for ${formatShiftSummary(offerPost.shift)} (time trade)` : 'Offer your shift (time trade)')
                                  : isOfferTrade
                                    ? (offerPost?.shift ? `Offer a shift for ${formatShiftSummary(offerPost.shift)}` : 'Offer your shift')
                                    : offerPost?.type === 'cash'
                                      ? (offerPost?.shift ? `Offer to take ${formatShiftSummary(offerPost.shift)}` : 'Offer to take shift')
                                      : offerPost?.type === 'flight_follow'
                                        ? (offerPost?.shift ? `Take flight follow — ${formatShiftSummary(offerPost.shift)}` : 'Take flight follow')
                                        : 'Respond to post'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
                    {offerPost?.shift && (
                        <div className="rounded-lg border border-sidebar-border/70 bg-muted/40 px-3 py-2 text-sm">
                            <p className="font-medium text-muted-foreground">Responding to</p>
                            <p className="mt-0.5 font-medium text-foreground">{formatShiftSummary(offerPost.shift)}</p>
                            {offerPost.poster_name && (
                                <p className="mt-1 text-xs text-muted-foreground">Posted by {offerPost.poster_name}</p>
                            )}
                        </div>
                    )}
                    {isOfferTrade ? (
                        <>
                            {offerPost && timeOffRanges.length > 0 && (() => {
                                const title = getTimeOffRangeTitleForDate(offerPost.shift.start_time_utc.slice(0, 10), timeOffRanges);
                                return title ? (
                                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                        The shift you would receive ({offerPost.shift.start_time_utc.slice(0, 10)}) is during {title} which you need off.
                                    </p>
                                ) : null;
                            })()}
                            {offerPost?.type === 'time_trade' && (
                                <p className="text-xs text-muted-foreground">
                                    Only shifts on the same start date as the posted shift are shown.
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Search your shifts, select one or more, and rank them in order of preference (first = most preferred to give up).
                            </p>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by position, workgroup, or date…"
                                    value={myShiftSearch}
                                    onChange={(e) => setMyShiftSearch(e.target.value)}
                                    className="h-9 pl-8"
                                />
                            </div>
                            {timeOffRanges.length > 0 && (
                                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={offerOnlyNeedOff}
                                        onChange={(e) => setOfferOnlyNeedOff(e.target.checked)}
                                        className="h-4 w-4 rounded border-input"
                                    />
                                    <span>Only show shifts I need off</span>
                                </label>
                            )}
                            <div className="mt-3 space-y-2 max-h-44 overflow-y-auto">
                                {myShifts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">You have no upcoming shifts to offer.</p>
                                ) : filteredMyShifts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {offerPost?.type === 'time_trade'
                                            ? 'No shifts on the same start date as the posted shift.'
                                            : offerOnlyNeedOff
                                              ? 'No shifts on days you need off.'
                                              : 'No shifts match your search.'}
                                    </p>
                                ) : (
                                    filteredMyShifts.map((s) => {
                                        const dateStr = s.start_time_utc.slice(0, 10);
                                        const { daysOffBefore, daysOffAfter } = dateStr
                                            ? getDaysOffBeforeAfter(dateStr, myShiftDates)
                                            : { daysOffBefore: 0, daysOffAfter: 0 };
                                        const inTimeOff = isDateInTimeOffRanges(dateStr, timeOffRanges);
                                        const selected = offerShiftIds.includes(s.id);
                                        return (
                                            <Label
                                                key={s.id}
                                                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${
                                                    selected ? 'border-primary bg-primary/5' : 'border-sidebar-border/70'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleShiftInOffer(s.id)}
                                                    className="mt-1 h-4 w-4 rounded border-input"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium">{s.position_name}</div>
                                                    {s.workgroup_name && (
                                                        <span className="text-xs text-muted-foreground">{s.workgroup_name}</span>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {formatCentral(s.start_time_utc)}
                                                    </p>
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
                                                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                                                Need off
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Label>
                                        );
                                    })
                                )}
                            </div>
                            {offerShiftIds.length > 0 && (
                                <div className="mt-3 rounded-lg border border-sidebar-border/70 bg-muted/30 p-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Your ranked offers (reorder with arrows)</p>
                                    <ul className="space-y-1 max-h-44 overflow-y-auto">
                                        {selectedMyShiftsOrdered.map((s, idx) => (
                                            <li key={s.id} className="flex items-center gap-2 rounded border border-sidebar-border/50 bg-background px-2 py-1.5 text-xs">
                                                <span className="w-5 shrink-0 font-medium text-muted-foreground">{idx + 1}.</span>
                                                <span className="min-w-0 flex-1 truncate">{s.position_name}</span>
                                                <span className="shrink-0 text-muted-foreground">{s.start_time_utc.slice(0, 10)}</span>
                                                <div className="flex shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => moveSelected(idx, 'up')}
                                                        disabled={idx === 0}
                                                    >
                                                        <ChevronUp className="size-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => moveSelected(idx, 'down')}
                                                        disabled={idx === selectedMyShiftsOrdered.length - 1}
                                                    >
                                                        <ChevronDown className="size-4" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {offerPost?.type === 'cash'
                                ? 'Submit to offer to take this shift. The poster can accept or decline.'
                                : 'Submit to let the poster know you want to take this flight follow. They can accept or decline.'}
                        </p>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="offer-response-notes" className="text-sm">Notes for the poster (optional)</Label>
                        <textarea
                            id="offer-response-notes"
                            rows={3}
                            value={offerResponseNotes}
                            onChange={(e) => setOfferResponseNotes(e.target.value)}
                            placeholder="Add any comments or notes for the poster…"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                    </div>
                    {offerError && (
                        <p className="text-sm text-destructive">{offerError}</p>
                    )}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background rounded-b-lg">
                        <Button variant="outline" onClick={() => setOfferPostId(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={submitOffer}
                            disabled={(isOfferTrade && offerShiftIds.length === 0) || offerSubmitting}
                        >
                            {offerSubmitting ? (editingOfferId != null ? 'Updating…' : 'Submitting…') : editingOfferId != null ? 'Update response' : isOfferTrade ? (offerPost?.type === 'time_trade' ? 'Submit time trade offer' : 'Submit offer') : 'Submit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
