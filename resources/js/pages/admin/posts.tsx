import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, EyeOff, Eye, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/button';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Post Manager', href: '/app/admin/posts' },
];

type ShiftInfo = {
    id: number;
    position_name: string;
    desk_type: string | null;
    start_time_utc: string;
    end_time_utc: string;
    regulatory: boolean;
    workgroup_name: string | null;
    assignee_id: number | null;
    assignee_name: string | null;
    assignee_email: string | null;
};

type OfferRow = {
    id: number;
    offered_by_id: number;
    offered_by_name: string | null;
    offered_by_email: string | null;
    offered_shift_id: number | null;
    offered_shift_summary: string | null;
    status: string;
    status_raw?: string;
    response_notes: string | null;
    created_at: string;
    poster_name?: string | null;
    poster_email?: string | null;
    shift_going_to_name?: string | null;
    cash_amount?: number | null;
    post_type_label?: string | null;
};

type ActivityItem = {
    at: string | null;
    event: string;
    label: string;
    actor: string | null;
    changes?: unknown;
};

type PostSubRow = {
    id: number;
    type: string;
    type_label: string;
    status: string;
    cash_amount: number | null;
    flight_follow_minutes: number | null;
    notes: string | null;
};

type PostRow = {
    shift_id: number | null;
    looking_for_work_post_id?: number;
    seeking_date?: string;
    post_ids: number[];
    owner_id: number | null;
    owner_name: string | null;
    owner_email: string | null;
    accepted_by_name: string | null;
    accepted_by_email: string | null;
    types: string[];
    types_label: string;
    status: string;
    statuses: string[];
    cash_amount: number | null;
    flight_follow_minutes: number | null;
    notes: string | null;
    view_count: number;
    click_count: number;
    hidden_by_count: number;
    transaction_count: number;
    offers_count: number;
    posts_created_at: string | null;
    posts_updated_at: string | null;
    shift: ShiftInfo | null;
    posts: PostSubRow[];
    offers: OfferRow[];
    activity: ActivityItem[];
};

type UserOption = { id: number; name: string; email: string };
type WorkgroupOption = { id: number; name: string };

type PaginatedPosts = {
    data: PostRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
};

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function decodePaginationLabel(label: string): string {
    return label
        .replace(/&laquo;/g, '\u00AB')
        .replace(/&raquo;/g, '\u00BB')
        .replace(/&lsaquo;/g, '\u2039')
        .replace(/&rsaquo;/g, '\u203A');
}

const ALL_VALUE = '__all__';

function SortHeader({
    field,
    label,
    sortField,
    sortDir,
    onToggle,
}: {
    field: string;
    label: string;
    sortField: string;
    sortDir: string;
    onToggle: (f: string) => void;
}) {
    return (
        <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => onToggle(field)}
        >
            {label}
            {sortField === field && (sortDir === 'asc' ? ' ↑' : ' ↓')}
        </button>
    );
}

const TYPE_OPTIONS = [
    { value: ALL_VALUE, label: 'Any type' },
    { value: 'trade', label: 'Trade' },
    { value: 'time_trade', label: 'Time trade' },
    { value: 'cash', label: 'Giveaway' },
    { value: 'flight_follow', label: 'Flight following' },
    { value: 'looking_for_work', label: 'Looking for work' },
];

const SORT_OPTIONS = [
    { value: 'posts_created_at', label: 'Created' },
    { value: 'posts_updated_at', label: 'Updated' },
    { value: 'view_count', label: 'Views' },
    { value: 'click_count', label: 'Clicks' },
    { value: 'transaction_count', label: 'Transactions' },
    { value: 'offers_count', label: 'Offers' },
];

export default function AdminPosts() {
    const props = usePage().props as {
        posts: PaginatedPosts;
        users: UserOption[];
        workgroups: WorkgroupOption[];
        status_options?: { value: string; label: string }[];
        filters: {
            user_id?: string;
            workgroup_id?: string;
            status?: string;
            type?: string;
            date_from?: string;
            date_to?: string;
            min_transactions?: string;
            min_offers?: string;
            search?: string;
        };
        sort: string;
        dir: string;
        flash?: { success?: string; error?: string };
    };
    const {
        posts,
        users,
        workgroups,
        status_options = [],
        filters = {},
        sort,
        dir,
        flash,
    } = props;
    const statusOptions =
        status_options.length > 0
            ? status_options
            : [
                  { value: ALL_VALUE, label: 'Any status' },
                  { value: 'open', label: 'Open' },
                  { value: 'accepted', label: 'Accepted' },
                  { value: 'closed', label: 'Closed' },
                  { value: 'cancelled', label: 'Cancelled' },
              ];
    const data = posts?.data ?? [];
    const [expandedShiftId, setExpandedShiftId] = useState<number | null>(null);
    const [filterUser, setFilterUser] = useState(filters.user_id ?? ALL_VALUE);
    const [filterWorkgroup, setFilterWorkgroup] = useState(
        filters.workgroup_id ?? ALL_VALUE,
    );
    const [filterStatus, setFilterStatus] = useState(
        filters.status ?? ALL_VALUE,
    );
    const [filterType, setFilterType] = useState(filters.type ?? ALL_VALUE);
    const [filterDateFrom, setFilterDateFrom] = useState(
        filters.date_from ?? '',
    );
    const [filterDateTo, setFilterDateTo] = useState(filters.date_to ?? '');
    const [filterMinTransactions, setFilterMinTransactions] = useState(
        filters.min_transactions ?? '',
    );
    const [filterMinOffers, setFilterMinOffers] = useState(
        filters.min_offers ?? '',
    );
    const [filterSearch, setFilterSearch] = useState(filters.search ?? '');
    const [sortField, setSortField] = useState(sort ?? 'posts_created_at');
    const [sortDir, setSortDir] = useState(dir ?? 'desc');

    const applyFilters = () => {
        const params: Record<string, string> = {
            sort: sortField,
            dir: sortDir,
        };
        if (filterUser && filterUser !== ALL_VALUE) params.user_id = filterUser;
        if (filterWorkgroup && filterWorkgroup !== ALL_VALUE)
            params.workgroup_id = filterWorkgroup;
        if (filterStatus && filterStatus !== ALL_VALUE)
            params.status = filterStatus;
        if (filterType && filterType !== ALL_VALUE) params.type = filterType;
        if (filterDateFrom) params.date_from = filterDateFrom;
        if (filterDateTo) params.date_to = filterDateTo;
        if (filterMinTransactions.trim() !== '')
            params.min_transactions = filterMinTransactions.trim();
        if (filterMinOffers.trim() !== '')
            params.min_offers = filterMinOffers.trim();
        if (filterSearch.trim() !== '') params.search = filterSearch.trim();
        router.get('/app/admin/posts', params);
    };

    const clearFilters = () => {
        setFilterUser(ALL_VALUE);
        setFilterWorkgroup(ALL_VALUE);
        setFilterStatus(ALL_VALUE);
        setFilterType(ALL_VALUE);
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterMinTransactions('');
        setFilterMinOffers('');
        setFilterSearch('');
        setSortField('posts_created_at');
        setSortDir('desc');
        router.get('/app/admin/posts');
    };

    const setShiftPostsStatus = (
        shiftId: number,
        status: 'open' | 'closed' | 'cancelled',
    ) => {
        router.put(
            `/app/admin/shifts/${shiftId}/posts-status`,
            { status },
            { preserveScroll: true },
        );
    };

    const removeShiftPosts = (shiftId: number) => {
        if (
            confirm('Remove all posts for this shift? This cannot be undone.')
        ) {
            router.delete(`/app/admin/shifts/${shiftId}/posts`, {
                preserveScroll: true,
            });
        }
    };

    const toggleSort = (field: string) => {
        const nextDir =
            sortField === field && sortDir === 'desc' ? 'asc' : 'desc';
        setSortField(field);
        setSortDir(nextDir);
        router.get('/app/admin/posts', {
            ...filters,
            sort: field,
            dir: nextDir,
            user_id: filterUser !== ALL_VALUE ? filterUser : undefined,
            workgroup_id:
                filterWorkgroup !== ALL_VALUE ? filterWorkgroup : undefined,
            status: filterStatus !== ALL_VALUE ? filterStatus : undefined,
            type: filterType !== ALL_VALUE ? filterType : undefined,
            date_from: filterDateFrom || undefined,
            date_to: filterDateTo || undefined,
            min_transactions: filterMinTransactions.trim() || undefined,
            min_offers: filterMinOffers.trim() || undefined,
            search: filterSearch.trim() || undefined,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Post Manager" />
            <div className="space-y-4 p-4">
                <h1 className="text-2xl font-semibold">Post Manager</h1>
                {flash?.success && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                        {flash.success}
                    </p>
                )}
                {flash?.error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {flash.error}
                    </p>
                )}

                {/* Filters */}
                <div className="space-y-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                    <div className="space-y-2">
                        <Label>
                            Search (owner name/email or shift position)
                        </Label>
                        <Input
                            placeholder="Search..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="max-w-md"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Owner</Label>
                            <Select
                                value={filterUser}
                                onValueChange={setFilterUser}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All owners" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_VALUE}>
                                        All owners
                                    </SelectItem>
                                    {users.map((u) => (
                                        <SelectItem
                                            key={u.id}
                                            value={String(u.id)}
                                        >
                                            {u.name} ({u.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Workgroup</Label>
                            <Select
                                value={filterWorkgroup}
                                onValueChange={setFilterWorkgroup}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All workgroups" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_VALUE}>
                                        All workgroups
                                    </SelectItem>
                                    {workgroups.map((wg) => (
                                        <SelectItem
                                            key={wg.id}
                                            value={String(wg.id)}
                                        >
                                            {wg.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={filterStatus}
                                onValueChange={setFilterStatus}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Any status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={filterType}
                                onValueChange={setFilterType}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Any type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Date from</Label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) =>
                                    setFilterDateFrom(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Date to</Label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) =>
                                    setFilterDateTo(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Min transactions (shift traded hands)</Label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="Any"
                                value={filterMinTransactions}
                                onChange={(e) =>
                                    setFilterMinTransactions(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Min offers</Label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="Any"
                                value={filterMinOffers}
                                onChange={(e) =>
                                    setFilterMinOffers(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sort</Label>
                            <Select
                                value={sortField}
                                onValueChange={setSortField}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Direction</Label>
                            <Select value={sortDir} onValueChange={setSortDir}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">
                                        Descending
                                    </SelectItem>
                                    <SelectItem value="asc">
                                        Ascending
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={applyFilters}>Apply filters</Button>
                        <Button variant="outline" onClick={clearFilters}>
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="min-w-0 overflow-hidden rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8" />
                                <TableHead>
                                    <SortHeader
                                        field="posts_created_at"
                                        label="Created"
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggle={toggleSort}
                                    />
                                </TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Shift</TableHead>
                                <TableHead>Types</TableHead>
                                <TableHead>Cash</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assignee</TableHead>
                                <TableHead className="text-right">
                                    <SortHeader
                                        field="view_count"
                                        label="Views"
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggle={toggleSort}
                                    />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortHeader
                                        field="click_count"
                                        label="Clicks"
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggle={toggleSort}
                                    />
                                </TableHead>
                                <TableHead
                                    className="text-right"
                                    title="Distinct users who have hidden this post"
                                >
                                    Hidden by
                                </TableHead>
                                <TableHead
                                    className="text-right"
                                    title="Times this shift has traded hands"
                                >
                                    <SortHeader
                                        field="transaction_count"
                                        label="Transactions"
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggle={toggleSort}
                                    />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortHeader
                                        field="offers_count"
                                        label="Offers"
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggle={toggleSort}
                                    />
                                </TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={15}
                                        className="py-8 text-center text-muted-foreground"
                                    >
                                        No posts match your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row) => {
                                    const rowKey =
                                        row.shift_id ??
                                        row.looking_for_work_post_id ??
                                        0;
                                    const isLfw =
                                        row.shift_id == null &&
                                        row.looking_for_work_post_id != null;
                                    return (
                                        <Fragment key={rowKey}>
                                            <TableRow
                                                className={
                                                    expandedShiftId === rowKey
                                                        ? 'bg-muted/50'
                                                        : ''
                                                }
                                            >
                                                <TableCell className="w-8">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            setExpandedShiftId(
                                                                expandedShiftId ===
                                                                    rowKey
                                                                    ? null
                                                                    : rowKey,
                                                            )
                                                        }
                                                    >
                                                        {expandedShiftId ===
                                                        rowKey ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    {row.posts_created_at
                                                        ? formatDate(
                                                              row.posts_created_at,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {row.owner_name ?? '—'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.owner_email ?? ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {row.shift ? (
                                                        <>
                                                            <div>
                                                                {
                                                                    row.shift
                                                                        .position_name
                                                                }
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatDateTime(
                                                                    row.shift
                                                                        .start_time_utc,
                                                                )}{' '}
                                                                ·{' '}
                                                                {row.shift
                                                                    .workgroup_name ??
                                                                    '—'}
                                                            </div>
                                                        </>
                                                    ) : isLfw &&
                                                      row.seeking_date ? (
                                                        <>
                                                            <div>
                                                                Looking for work
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {
                                                                    row.seeking_date
                                                                }
                                                            </div>
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {row.types_label || '—'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {row.cash_amount != null &&
                                                    Number(row.cash_amount) > 0
                                                        ? `$${Number(row.cash_amount).toFixed(2)}`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={
                                                            row.status ===
                                                            'Open'
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : row.status ===
                                                                    'Accepted'
                                                                  ? 'text-blue-600 dark:text-blue-400'
                                                                  : 'text-muted-foreground'
                                                        }
                                                    >
                                                        {row.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {row.shift
                                                        ?.assignee_name ? (
                                                        <>
                                                            <div>
                                                                {
                                                                    row.shift
                                                                        .assignee_name
                                                                }
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {row.shift
                                                                    .assignee_email ??
                                                                    ''}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {row.view_count}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {row.click_count}
                                                </TableCell>
                                                <TableCell
                                                    className="text-right"
                                                    title="Distinct users who have hidden this post"
                                                >
                                                    {row.hidden_by_count ?? 0}
                                                </TableCell>
                                                <TableCell
                                                    className="text-right"
                                                    title="Times this shift has traded hands"
                                                >
                                                    {row.transaction_count ?? 0}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {row.offers_count ??
                                                        row.offers.length}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    {!isLfw &&
                                                        row.status !==
                                                            'Open' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setShiftPostsStatus(
                                                                        row.shift_id!,
                                                                        'open',
                                                                    )
                                                                }
                                                                title="Activate all (set Open)"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    {!isLfw &&
                                                        row.status ===
                                                            'Open' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setShiftPostsStatus(
                                                                        row.shift_id!,
                                                                        'closed',
                                                                    )
                                                                }
                                                                title="Deactivate all (set Closed)"
                                                            >
                                                                <EyeOff className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    {!isLfw && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() =>
                                                                removeShiftPosts(
                                                                    row.shift_id!,
                                                                )
                                                            }
                                                            title="Remove all posts for this shift"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {expandedShiftId === rowKey && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell
                                                        colSpan={15}
                                                        className="p-4"
                                                    >
                                                        <div className="grid gap-6 md:grid-cols-2">
                                                            <div>
                                                                <h4 className="mb-2 font-medium">
                                                                    {isLfw
                                                                        ? 'Post history (admin only)'
                                                                        : 'Shift & post history (admin only)'}
                                                                </h4>
                                                                {!row.activity ||
                                                                row.activity
                                                                    .length ===
                                                                    0 ? (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        No
                                                                        activity
                                                                        yet.
                                                                    </p>
                                                                ) : (
                                                                    <ul className="space-y-2 text-sm">
                                                                        {row.activity.map(
                                                                            (
                                                                                item,
                                                                                idx,
                                                                            ) => (
                                                                                <li
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    className="rounded border border-sidebar-border/70 p-2 dark:border-sidebar-border"
                                                                                >
                                                                                    <span className="text-muted-foreground">
                                                                                        {item.at
                                                                                            ? formatDateTime(
                                                                                                  item.at,
                                                                                              )
                                                                                            : '—'}
                                                                                    </span>
                                                                                    <div className="mt-0.5 font-medium">
                                                                                        {
                                                                                            item.label
                                                                                        }
                                                                                    </div>
                                                                                    {item.actor && (
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            by{' '}
                                                                                            {
                                                                                                item.actor
                                                                                            }
                                                                                        </div>
                                                                                    )}
                                                                                    {item.event ===
                                                                                        'edit' &&
                                                                                        item.changes !=
                                                                                            null && (
                                                                                            <pre className="mt-1 text-xs break-words whitespace-pre-wrap">
                                                                                                {typeof item.changes ===
                                                                                                'object'
                                                                                                    ? JSON.stringify(
                                                                                                          item.changes,
                                                                                                          null,
                                                                                                          2,
                                                                                                      )
                                                                                                    : String(
                                                                                                          item.changes,
                                                                                                      )}
                                                                                            </pre>
                                                                                        )}
                                                                                </li>
                                                                            ),
                                                                        )}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="mb-2 font-medium">
                                                                    Offers &
                                                                    responses
                                                                </h4>
                                                                {!row.offers ||
                                                                row.offers
                                                                    .length ===
                                                                    0 ? (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        No
                                                                        offers.
                                                                    </p>
                                                                ) : (
                                                                    <ul className="space-y-2 text-sm">
                                                                        {row.offers.map(
                                                                            (
                                                                                o,
                                                                            ) => (
                                                                                <li
                                                                                    key={
                                                                                        o.id
                                                                                    }
                                                                                    className="rounded border border-sidebar-border/70 p-3 dark:border-sidebar-border"
                                                                                >
                                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                        <span className="font-medium">
                                                                                            {o.offered_by_name ??
                                                                                                o.offered_by_email ??
                                                                                                'Unknown'}
                                                                                        </span>
                                                                                        <span
                                                                                            className={
                                                                                                o.status ===
                                                                                                'accepted'
                                                                                                    ? 'text-green-600 dark:text-green-400'
                                                                                                    : o.status ===
                                                                                                        'rejected'
                                                                                                      ? 'text-red-600 dark:text-red-400'
                                                                                                      : 'text-muted-foreground'
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                o.status
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                    {(o.poster_name ??
                                                                                        o.poster_email) && (
                                                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                                                            Posted
                                                                                            by:{' '}
                                                                                            {o.poster_name ??
                                                                                                o.poster_email ??
                                                                                                '—'}
                                                                                        </div>
                                                                                    )}
                                                                                    {o.shift_going_to_name && (
                                                                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                                                                            Shift
                                                                                            going
                                                                                            to:{' '}
                                                                                            {
                                                                                                o.shift_going_to_name
                                                                                            }
                                                                                        </div>
                                                                                    )}
                                                                                    {o.cash_amount !=
                                                                                        null &&
                                                                                        Number(
                                                                                            o.cash_amount,
                                                                                        ) >
                                                                                            0 && (
                                                                                            <div className="mt-0.5 text-xs font-medium text-foreground">
                                                                                                $
                                                                                                {Number(
                                                                                                    o.cash_amount,
                                                                                                ).toFixed(
                                                                                                    2,
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    {o.offered_shift_summary && (
                                                                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                                                                            {
                                                                                                o.offered_shift_summary
                                                                                            }
                                                                                        </div>
                                                                                    )}
                                                                                    {o.response_notes && (
                                                                                        <div className="mt-1 border-t border-sidebar-border/70 pt-1 text-xs dark:border-sidebar-border">
                                                                                            Response:{' '}
                                                                                            {
                                                                                                o.response_notes
                                                                                            }
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                                                        {formatDateTime(
                                                                                            o.created_at,
                                                                                        )}
                                                                                    </div>
                                                                                </li>
                                                                            ),
                                                                        )}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {row.notes && (
                                                            <div className="mt-2 text-sm">
                                                                <span className="text-muted-foreground">
                                                                    Notes:{' '}
                                                                </span>
                                                                {row.notes}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {posts?.links && posts.links.length > 2 && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {posts.links.map((link, i) => (
                            <span key={i}>
                                {link.url ? (
                                    <a
                                        href={link.url}
                                        className={`rounded px-2 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : 'hover:underline'}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const u = new URL(link.url!);
                                            router.get(u.pathname + u.search);
                                        }}
                                    >
                                        {decodePaginationLabel(link.label)}
                                    </a>
                                ) : (
                                    <span className="px-2 py-1 text-sm text-muted-foreground">
                                        {decodePaginationLabel(link.label)}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
