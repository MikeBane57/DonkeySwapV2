import { Head, router, usePage } from '@inertiajs/react';
import { Briefcase, ChevronRight, DollarSign, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/app' },
    { title: 'Looking for work', href: '/app/looking-for-work' },
];

type Workgroup = { id: number; name: string; desk_types?: { code: string; label: string }[] };
type ShiftSummary = {
    id: number;
    position_name: string;
    desk_type?: string | null;
    start_time_utc: string;
    end_time_utc: string;
    workgroup_name?: string | null;
};
type OfferSummary = {
    id: number;
    offered_by_user_id: number;
    offered_by_name: string | null;
    offered_shift_id: number;
    offered_cash: number | null;
    response_notes: string | null;
    shift_summary: {
        position_name: string;
        desk_type?: string | null;
        start_time_utc: string;
        end_time_utc: string;
        workgroup_name?: string | null;
    } | null;
};
type PostItem = {
    id: number;
    user_id: number;
    poster_name: string | null;
    seeking_date: string;
    seeking_desk_types: string[];
    seeking_cash: number;
    seeking_obo: boolean;
    status: string;
    notes: string | null;
    pending_offer_count: number;
    is_mine: boolean;
    my_offer: {
        id: number;
        offered_shift_id: number;
        offered_cash: number | null;
        response_notes: string | null;
    } | null;
    offers: OfferSummary[];
};

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (!match) return '';
    return decodeURIComponent(match[1].trim());
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
        return iso;
    }
}

type DeskTypeOption = { value: string; label: string };

export default function LookingForWorkPage() {
    const props = usePage().props as {
        posts: PostItem[];
        workgroups: Workgroup[];
        myShiftsByDate: Record<string, ShiftSummary[]>;
        filters: { date_from?: string; date_to?: string; workgroup_id?: string; desk_type?: string; min_cash?: string };
    };
    const { posts, workgroups, myShiftsByDate = {}, filters = {} } = props;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [onlyDaysWithShifts, setOnlyDaysWithShifts] = useState(false);
    const [minCashLocal, setMinCashLocal] = useState(filters.min_cash ?? '');
    useEffect(() => {
        setMinCashLocal(filters.min_cash ?? '');
    }, [filters.min_cash]);
    const [createOpen, setCreateOpen] = useState(false);
    const [offerPostId, setOfferPostId] = useState<number | null>(null);
    const [acceptingOfferId, setAcceptingOfferId] = useState<number | null>(null);

    const [createDate, setCreateDate] = useState('');
    const [createDeskTypes, setCreateDeskTypes] = useState<string[]>([]);
    const [createCash, setCreateCash] = useState('');
    const [createObo, setCreateObo] = useState(false);
    const [createNotes, setCreateNotes] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [offerShiftId, setOfferShiftId] = useState<number | null>(null);
    const [offerCash, setOfferCash] = useState('');
    const [offerNotes, setOfferNotes] = useState('');
    const [offerSubmitting, setOfferSubmitting] = useState(false);
    const [offerError, setOfferError] = useState<string | null>(null);
    const [editOfferContext, setEditOfferContext] = useState<{ post: PostItem; offerId: number; shiftId: number; cash: string; notes: string } | null>(null);
    const [editOfferSubmitting, setEditOfferSubmitting] = useState(false);
    const [withdrawingOfferId, setWithdrawingOfferId] = useState<number | null>(null);

    const deskTypeOptions = useMemo(() => {
        const seen = new Set<string>();
        const out: DeskTypeOption[] = [];
        for (const wg of workgroups) {
            for (const d of wg.desk_types ?? []) {
                if (!seen.has(d.code)) {
                    seen.add(d.code);
                    out.push({ value: d.code, label: d.label ?? d.code });
                }
            }
        }
        return out;
    }, [workgroups]);

    const applyFilters = useCallback((next: Record<string, string | undefined>) => {
        router.get('/app/looking-for-work', { ...filters, ...next }, { preserveState: true });
    }, [filters]);

    const postsFiltered = useMemo(() => {
        if (!onlyDaysWithShifts) return posts;
        return posts.filter((p) => {
            const shifts = myShiftsByDate[p.seeking_date];
            return Array.isArray(shifts) && shifts.length > 0;
        });
    }, [posts, onlyDaysWithShifts, myShiftsByDate]);

    const refresh = useCallback(() => {
        router.reload();
    }, []);

    const handleCreate = useCallback(async () => {
        setCreateError(null);
        if (!createDate || !createCash.trim() || Number(createCash) < 0) {
            setCreateError('Date and cash amount are required.');
            return;
        }
        setCreateSubmitting(true);
        try {
            const res = await fetch('/api/looking-for-work/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    seeking_date: createDate,
                    seeking_desk_types: createDeskTypes.length ? createDeskTypes : null,
                    seeking_cash: Number(createCash),
                    seeking_obo: createObo,
                    notes: createNotes.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                setCreateOpen(false);
                setCreateDate('');
                setCreateDeskTypes([]);
                setCreateCash('');
                setCreateObo(false);
                setCreateNotes('');
                refresh();
            } else {
                setCreateError(data.message || (res.status === 422 ? 'Validation failed.' : 'Failed to create post.'));
            }
        } finally {
            setCreateSubmitting(false);
        }
    }, [createDate, createCash, createDeskTypes, createObo, createNotes, refresh]);

    const handleOffer = useCallback(async (post: PostItem) => {
        if (!offerShiftId) {
            setOfferError('Select a shift to offer.');
            return;
        }
        setOfferError(null);
        setOfferSubmitting(true);
        try {
            const res = await fetch(`/api/looking-for-work/posts/${post.id}/offers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    offered_shift_id: offerShiftId,
                    offered_cash: post.seeking_obo && offerCash.trim() !== '' ? Number(offerCash) : null,
                    response_notes: offerNotes.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                setOfferPostId(null);
                setOfferShiftId(null);
                setOfferCash('');
                setOfferNotes('');
                refresh();
            } else {
                setOfferError(data.message || 'Failed to submit offer.');
            }
        } finally {
            setOfferSubmitting(false);
        }
    }, [offerShiftId, offerCash, offerNotes, refresh]);

    const handleAcceptOffer = useCallback(async (offerId: number) => {
        setAcceptingOfferId(offerId);
        try {
            const res = await fetch(`/api/looking-for-work/offers/${offerId}/accept`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                refresh();
            }
        } finally {
            setAcceptingOfferId(null);
        }
    }, [refresh]);

    const allDeskTypes = workgroups.flatMap((wg) => (wg.desk_types ?? []).map((d) => ({ ...d, workgroup: wg.name })));
    const postForOffer = offerPostId ? posts.find((p) => p.id === offerPostId) : null;
    const shiftsForOffer = postForOffer && myShiftsByDate[postForOffer.seeking_date] ? myShiftsByDate[postForOffer.seeking_date] : [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Looking for work" />
            <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-semibold">Looking for work</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Post when you want to pick up a shift and the cash you&apos;ll pay. Others with a shift that day can offer their shift.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            Create post
                        </Button>
                        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="rounded-lg border border-sidebar-border/70 bg-muted/30 dark:border-sidebar-border">
                    <div className="flex w-full items-center gap-2 px-3 py-2">
                        <CollapsibleTrigger asChild>
                            <button type="button" className="flex items-center gap-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg -m-1 p-1">
                                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
                                Filters
                            </button>
                        </CollapsibleTrigger>
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
                                            {deskTypeOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">From date</Label>
                                    <Input
                                        type="date"
                                        value={filters.date_from ?? ''}
                                        onChange={(e) => applyFilters({ date_from: e.target.value || undefined })}
                                        className="h-9 w-40 mt-0.5"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">To date</Label>
                                    <Input
                                        type="date"
                                        value={filters.date_to ?? ''}
                                        onChange={(e) => applyFilters({ date_to: e.target.value || undefined })}
                                        className="h-9 w-40 mt-0.5"
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
                                        onBlur={() => applyFilters({ min_cash: minCashLocal.trim() || undefined })}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters({ min_cash: minCashLocal.trim() || undefined })}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Posts:</span>
                                    <div className="inline-flex rounded-md border border-sidebar-border/70 bg-muted/50 p-0.5 dark:border-sidebar-border">
                                        <button
                                            type="button"
                                            onClick={() => setOnlyDaysWithShifts(false)}
                                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                                !onlyDaysWithShifts ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            All posts
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOnlyDaysWithShifts(true)}
                                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                                onlyDaysWithShifts ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Only days I have shifts
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {postsFiltered.length === 0 ? (
                        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            {posts.length === 0 ? 'No posts match. Create one or adjust filters.' : 'No posts on days you have shifts. Try "All posts" or adjust filters.'}
                        </p>
                    ) : (
                        postsFiltered.map((post) => {
                            const hasMyOffer = !!post.my_offer;
                            return (
                                <div
                                    key={post.id}
                                    className={`flex flex-col rounded-lg border bg-card p-2.5 dark:border-sidebar-border ${
                                        hasMyOffer ? 'border-2 border-primary dark:border-primary' : 'border border-sidebar-border/70'
                                    }`}
                                >
                                    <div className="flex flex-1 flex-wrap items-start justify-between gap-1.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="truncate text-sm font-medium">{post.poster_name ?? 'Someone'}</span>
                                                <span className="shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                                                    <DollarSign className="inline h-3 w-3" /> ${Number(post.seeking_cash).toFixed(0)}
                                                    {post.seeking_obo && ' OBO'}
                                                </span>
                                                {post.pending_offer_count > 0 && (
                                                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                        {post.pending_offer_count === 1 ? '1 offer' : `${post.pending_offer_count} offers`}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{post.seeking_date}</p>
                                            {post.seeking_desk_types?.length > 0 && (
                                                <p className="text-xs text-muted-foreground">Desk types: {post.seeking_desk_types.join(', ')}</p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                                            {hasMyOffer ? (
                                                <>
                                                    <span className="text-xs text-muted-foreground">You offered</span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            setEditOfferContext({ post, offerId: post.my_offer!.id, shiftId: post.my_offer!.offered_shift_id, cash: post.my_offer!.offered_cash != null ? String(post.my_offer!.offered_cash) : '', notes: post.my_offer!.response_notes ?? '' });
                                                        }}
                                                    >
                                                        Edit offer
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                                        disabled={withdrawingOfferId === post.my_offer!.id}
                                                        onClick={async () => {
                                                            if (!window.confirm('Withdraw your offer? The poster will no longer see it.')) return;
                                                            setWithdrawingOfferId(post.my_offer!.id);
                                                            try {
                                                                const res = await fetch(`/api/looking-for-work/offers/${post.my_offer!.id}/withdraw`, {
                                                                    method: 'POST',
                                                                    headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                                                                    credentials: 'include',
                                                                });
                                                                if (res.ok) router.reload();
                                                            } finally {
                                                                setWithdrawingOfferId(null);
                                                            }
                                                        }}
                                                    >
                                                        {withdrawingOfferId === post.my_offer!.id ? '…' : 'Cancel offer'}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setOfferPostId(post.id);
                                                        setOfferShiftId(null);
                                                        setOfferCash('');
                                                        setOfferNotes('');
                                                        setOfferError(null);
                                                    }}
                                                >
                                                    Offer your shift
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {post.notes && (
                                        <p className="mt-1 text-xs text-muted-foreground" title={post.notes}>
                                            {post.notes}
                                        </p>
                                    )}
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-sidebar-border/50 pt-2 dark:border-sidebar-border">
                                        <span className="text-xs text-muted-foreground">by {post.poster_name ?? 'Someone'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Create post modal */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create &quot;Looking for work&quot; post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Date you want to work</Label>
                            <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} className="mt-1" min={new Date().toISOString().slice(0, 10)} />
                        </div>
                        <div>
                            <Label>Desk types (optional)</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {allDeskTypes.map((dt) => (
                                    <label key={dt.code} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={createDeskTypes.includes(dt.code)}
                                            onCheckedChange={(c) => setCreateDeskTypes((prev) => (c ? [...prev, dt.code] : prev.filter((x) => x !== dt.code)))}
                                        />
                                        {dt.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>Cash amount ($)</Label>
                            <Input type="number" min={0} step={1} value={createCash} onChange={(e) => setCreateCash(e.target.value)} className="mt-1" placeholder="e.g. 500" />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={createObo} onCheckedChange={(c) => setCreateObo(!!c)} />
                            Or best offer (OBO) — responders can offer more or less
                        </label>
                        <div>
                            <Label>Notes (optional)</Label>
                            <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} className="mt-1" rows={2} placeholder="e.g. Prefer morning" />
                        </div>
                        {createError && <p className="text-sm text-destructive">{createError}</p>}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={createSubmitting}>{createSubmitting ? '…' : 'Create'}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Offer shift modal */}
            <Dialog open={!!offerPostId} onOpenChange={(open) => !open && setOfferPostId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Offer your shift</DialogTitle>
                    </DialogHeader>
                    {postForOffer && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {postForOffer.poster_name} is looking for a shift on {postForOffer.seeking_date} for ${Number(postForOffer.seeking_cash).toFixed(0)}
                                {postForOffer.seeking_obo && ' (OBO)'}.
                            </p>
                            <div>
                                <Label>Your shift on that date</Label>
                                <Select value={offerShiftId ? String(offerShiftId) : ''} onValueChange={(v) => setOfferShiftId(v ? Number(v) : null)}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select shift" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shiftsForOffer.map((s) => (
                                            <SelectItem key={s.id} value={String(s.id)}>
                                                {s.position_name}{s.desk_type ? ` · ${s.desk_type}` : ''} · {formatTime(s.start_time_utc)}–{formatTime(s.end_time_utc)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {postForOffer.seeking_obo && (
                                <div>
                                    <Label>Your cash offer ($, optional)</Label>
                                    <Input type="number" min={0} step={1} value={offerCash} onChange={(e) => setOfferCash(e.target.value)} className="mt-1" placeholder="e.g. 450" />
                                </div>
                            )}
                            <div>
                                <Label>Notes (optional)</Label>
                                <Textarea value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} className="mt-1" rows={2} />
                            </div>
                            {offerError && <p className="text-sm text-destructive">{offerError}</p>}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOfferPostId(null)}>Cancel</Button>
                                <Button onClick={() => handleOffer(postForOffer)} disabled={offerSubmitting}>{offerSubmitting ? '…' : 'Submit offer'}</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit my offer modal */}
            <Dialog open={!!editOfferContext} onOpenChange={(open) => !open && setEditOfferContext(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit your offer</DialogTitle>
                    </DialogHeader>
                    {editOfferContext && (() => {
                        const post = editOfferContext.post;
                        const shiftsOnDate = myShiftsByDate[post.seeking_date] ?? [];
                        return (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Shift date: {post.seeking_date}. Choose which shift to offer and optional cash/notes.
                                </p>
                                <div>
                                    <Label>Your shift on that date</Label>
                                    <Select
                                        value={String(editOfferContext.shiftId)}
                                        onValueChange={(v) => setEditOfferContext((prev) => prev ? { ...prev, shiftId: Number(v) } : null)}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select shift" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shiftsOnDate.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>
                                                    {s.position_name}{s.desk_type ? ` · ${s.desk_type}` : ''} · {formatTime(s.start_time_utc)}–{formatTime(s.end_time_utc)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {post.seeking_obo && (
                                    <div>
                                        <Label>Your cash offer ($, optional)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={editOfferContext.cash}
                                            onChange={(e) => setEditOfferContext((prev) => prev ? { ...prev, cash: e.target.value } : null)}
                                            className="mt-1"
                                        />
                                    </div>
                                )}
                                <div>
                                    <Label>Notes (optional)</Label>
                                    <Textarea
                                        value={editOfferContext.notes}
                                        onChange={(e) => setEditOfferContext((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                                        className="mt-1"
                                        rows={2}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setEditOfferContext(null)} disabled={editOfferSubmitting}>Cancel</Button>
                                    <Button
                                        disabled={editOfferSubmitting}
                                        onClick={async () => {
                                            setEditOfferSubmitting(true);
                                            try {
                                                const res = await fetch(`/api/looking-for-work/offers/${editOfferContext.offerId}`, {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        Accept: 'application/json',
                                                        'X-XSRF-TOKEN': getCsrfToken(),
                                                        'X-Requested-With': 'XMLHttpRequest',
                                                    },
                                                    credentials: 'include',
                                                    body: JSON.stringify({
                                                        offered_shift_id: editOfferContext.shiftId,
                                                        offered_cash: post.seeking_obo && editOfferContext.cash !== '' ? Number(editOfferContext.cash) || null : null,
                                                        response_notes: editOfferContext.notes || null,
                                                    }),
                                                });
                                                if (res.ok) {
                                                    setEditOfferContext(null);
                                                    router.reload();
                                                }
                                            } finally {
                                                setEditOfferSubmitting(false);
                                            }
                                        }}
                                    >
                                        {editOfferSubmitting ? 'Saving…' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
