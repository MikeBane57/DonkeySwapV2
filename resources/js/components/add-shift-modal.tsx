import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

type AllowedStartTime = { start_time: string; default_duration_minutes: number };
type PositionOption = { label: string; type?: string; sublocation_type?: string | null; shift_type?: string };
type DeskTypeOption = { code: string; label: string };
type WorkgroupOption = {
    id: number;
    name: string;
    allowed_start_times?: AllowedStartTime[];
    desk_types?: DeskTypeOption[];
    positions?: PositionOption[];
};

function formatDurationMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/** Normalize to 24-hour HH:mm for display and API (e.g. "8:00" -> "08:00") */
function formatTime24(timeStr: string): string {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return timeStr;
    const h = Math.max(0, Math.min(23, parseInt(match[1], 10)));
    const m = Math.max(0, Math.min(59, parseInt(match[2], 10)));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
    domestic_dispatch: 'Domestic dispatch',
    assistant_desk: 'Assistant desk',
    etops: 'ETOPS',
    intl: 'INTL',
    regional: 'Regional (G)',
    sector: 'Sector (S)',
    nextday: 'NextDay (R)',
    extra: 'Extra',
};

type AddShiftModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workgroups: WorkgroupOption[];
    defaultWorkgroupId?: number | null;
    defaultRegulatory?: boolean;
    onSuccess: () => void;
};

export function AddShiftModal({
    open,
    onOpenChange,
    workgroups,
    defaultWorkgroupId = null,
    defaultRegulatory = false,
    onSuccess,
}: AddShiftModalProps) {
    const [workgroupId, setWorkgroupId] = useState<string>(() => {
        if (defaultWorkgroupId != null && workgroups.some((wg) => wg.id === defaultWorkgroupId)) {
            return String(defaultWorkgroupId);
        }
        return '';
    });
    const [shiftType, setShiftType] = useState('');
    const [positionName, setPositionName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [nonStandardShift, setNonStandardShift] = useState(false);
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('16:30');
    const [regulatory, setRegulatory] = useState(defaultRegulatory);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedWorkgroup = workgroupId ? workgroups.find((wg) => wg.id === parseInt(workgroupId, 10)) : null;
    const allowedStartTimes = selectedWorkgroup?.allowed_start_times ?? [];
    const positionOptions = selectedWorkgroup?.positions ?? [];
    const hasPositionOptions = positionOptions.length > 0;

    const shiftTypesAvailable = (() => {
        const fromDeskTypes = selectedWorkgroup?.desk_types?.map((d) => d.code).filter(Boolean) ?? [];
        if (fromDeskTypes.length > 0) return [...new Set(fromDeskTypes)].sort();
        const types = new Set<string>();
        positionOptions.forEach((p) => {
            if (p.shift_type) types.add(p.shift_type);
        });
        return Array.from(types).sort();
    })();
    const showShiftTypeFilter = shiftTypesAvailable.length > 0;
    const filteredPositionOptions = shiftType
        ? positionOptions.filter((p) => p.shift_type === shiftType)
        : positionOptions;

    const [positionIsCustom, setPositionIsCustom] = useState(false);

    useEffect(() => {
        if (open) {
            setRegulatory(defaultRegulatory);
            setNonStandardShift(false);
            setPositionIsCustom(false);
            setShiftType('');
            if (defaultWorkgroupId != null && workgroups.some((wg) => wg.id === defaultWorkgroupId)) {
                setWorkgroupId(String(defaultWorkgroupId));
            }
        }
    }, [open, defaultRegulatory, defaultWorkgroupId, workgroups]);

    useEffect(() => {
        setShiftType('');
        setPositionIsCustom(false);
        setPositionName('');
    }, [workgroupId]);

    useEffect(() => {
        if (shiftType && positionName && !filteredPositionOptions.some((p) => p.label === positionName)) {
            setPositionName('');
            setPositionIsCustom(false);
        }
    }, [shiftType, filteredPositionOptions, positionName]);

    useEffect(() => {
        if (workgroupId && allowedStartTimes.length > 0 && !allowedStartTimes.some((t) => formatTime24(t.start_time) === formatTime24(startTime))) {
            setStartTime(formatTime24(allowedStartTimes[0].start_time));
        }
        if (!workgroupId) {
            setStartTime('');
        }
    }, [workgroupId, allowedStartTimes]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!workgroupId || !positionName.trim() || !startDate || !startTime) {
            setError('Please fill in workgroup, desk, start date, and start time.');
            return;
        }
        if (nonStandardShift && (!endDate || !endTime)) {
            setError('Please fill in end date and end time for non-standard shift.');
            return;
        }
        setSaving(true);
        try {
            const selectedPosition = !positionIsCustom
                ? filteredPositionOptions.find((p) => p.label === positionName.trim())
                : null;
            const body: Record<string, unknown> = {
                workgroup_id: parseInt(workgroupId, 10),
                position_name: positionName.trim(),
                start_date: startDate,
                start_time: formatTime24(startTime),
                regulatory,
            };
            if (shiftType) {
                body.desk_type = shiftType;
            } else if (selectedPosition?.shift_type) {
                body.desk_type = selectedPosition.shift_type;
            } else if ((positionIsCustom || !hasPositionOptions) && shiftTypesAvailable.includes('extra')) {
                body.desk_type = 'extra';
            }
            if (nonStandardShift) {
                body.end_date = endDate;
                body.end_time = formatTime24(endTime);
            }
            const res = await fetch('/api/shifts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onOpenChange(false);
                onSuccess();
                setWorkgroupId('');
                setPositionName('');
                setStartDate('');
                setStartTime('');
                setEndDate('');
                setEndTime('16:30');
                setNonStandardShift(false);
                setRegulatory(false);
            } else {
                setError(data.message ?? (data.errors ? Object.values(data.errors).flat().join(' ') : 'Failed to add shift.'));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Add shift
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2">
                        {error && (
                            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                                {error}
                            </p>
                        )}
                        <div>
                            <Label htmlFor="add-shift-workgroup">Workgroup</Label>
                            <select
                                id="add-shift-workgroup"
                                value={workgroupId}
                                onChange={(e) => setWorkgroupId(e.target.value)}
                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                required
                            >
                                <option value="">Select workgroup</option>
                                {workgroups.map((wg) => (
                                    <option key={wg.id} value={wg.id}>
                                        {wg.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {showShiftTypeFilter && (
                            <div>
                                <Label htmlFor="add-shift-type">Type of shift</Label>
                                <select
                                    id="add-shift-type"
                                    value={shiftType}
                                    onChange={(e) => setShiftType(e.target.value)}
                                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">All types</option>
                                    {shiftTypesAvailable.map((st) => (
                                        <option key={st} value={st}>
                                            {selectedWorkgroup?.desk_types?.find((d) => d.code === st)?.label ?? SHIFT_TYPE_LABELS[st] ?? st}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="add-shift-position">Desk / position</Label>
                            {hasPositionOptions ? (
                                <div className="mt-1 space-y-2">
                                    <select
                                        id="add-shift-position"
                                        value={positionIsCustom ? '__custom__' : positionName}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === '__custom__') {
                                                setPositionIsCustom(true);
                                                setPositionName('');
                                                if (shiftTypesAvailable.includes('extra')) setShiftType('extra');
                                            } else {
                                                setPositionIsCustom(false);
                                                setPositionName(v);
                                            }
                                        }}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        required={!positionIsCustom}
                                    >
                                        <option value="">Select position</option>
                                        {filteredPositionOptions.map((p) => (
                                            <option key={p.label} value={p.label}>
                                                {p.label}
                                                {p.sublocation_type ? ` (${p.sublocation_type})` : ''}
                                            </option>
                                        ))}
                                        <option value="__custom__">Custom…</option>
                                    </select>
                                    {positionIsCustom && (
                                        <Input
                                            value={positionName}
                                            onChange={(e) => setPositionName(e.target.value)}
                                            placeholder="Enter custom position"
                                            className="mt-1"
                                            required
                                        />
                                    )}
                                </div>
                            ) : (
                                <Input
                                    id="add-shift-position"
                                    value={positionName}
                                    onChange={(e) => setPositionName(e.target.value)}
                                    placeholder="e.g. 06 S2, G1, Desk 1"
                                    className="mt-1"
                                    required
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="add-shift-start-date">Start date</Label>
                                <Input
                                    id="add-shift-start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="add-shift-start-time">Start time</Label>
                                {!nonStandardShift && allowedStartTimes.length > 0 ? (
                                    <select
                                        id="add-shift-start-time"
                                        value={formatTime24(startTime) || startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        required
                                    >
                                        <option value="">Select start time</option>
                                        {allowedStartTimes.map((t) => {
                                            const t24 = formatTime24(t.start_time);
                                            return (
                                                <option key={t24} value={t24}>
                                                    {t24} ({formatDurationMinutes(t.default_duration_minutes)})
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <Input
                                        id="add-shift-start-time"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="mt-1"
                                        required
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="add-shift-non-standard"
                                checked={nonStandardShift}
                                onCheckedChange={(v) => setNonStandardShift(v === true)}
                            />
                            <Label htmlFor="add-shift-non-standard" className="cursor-pointer text-sm font-normal">
                                Non-standard shift (custom start and end time)
                            </Label>
                        </div>
                        {nonStandardShift && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="add-shift-end-date">End date</Label>
                                    <Input
                                        id="add-shift-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="add-shift-end-time">End time</Label>
                                    <Input
                                        id="add-shift-end-time"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="add-shift-regulatory"
                                checked={regulatory}
                                onCheckedChange={(v) => setRegulatory(v === true)}
                            />
                            <Label htmlFor="add-shift-regulatory" className="cursor-pointer text-sm font-normal">
                                Regulatory
                            </Label>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Adding…' : 'Add shift'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
