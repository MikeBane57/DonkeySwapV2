import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/app/settings/profile' },
    { title: 'Preferences', href: '/app/settings/preferences' },
];

type DeskTypeOption = { value: string; label: string };

type WorkgroupDeskSection = {
    workgroup_id: number;
    workgroup_name: string;
    desk_type_options: DeskTypeOption[];
};

export default function Preferences({
    desired_desk_types = [],
    desk_options_by_workgroup = [],
    shift_start_time_min = null,
    shift_start_time_max = null,
    willing_double_am_pm = false,
    willing_double_pm_midnight = false,
    willing_double_midnight_am = false,
    double_gap_minutes_acceptable = null,
    max_doubles_in_row = null,
    hide_posts_that_would_be_double = false,
    status,
}: {
    desired_desk_types: string[];
    desk_options_by_workgroup?: WorkgroupDeskSection[];
    shift_start_time_min?: string | null;
    shift_start_time_max?: string | null;
    willing_double_am_pm?: boolean;
    willing_double_pm_midnight?: boolean;
    willing_double_midnight_am?: boolean;
    double_gap_minutes_acceptable?: number | null;
    max_doubles_in_row?: number | null;
    hide_posts_that_would_be_double?: boolean;
    status?: string;
}) {
    const { data, setData, put, processing, errors } = useForm({
        desired_desk_types: desired_desk_types as string[],
        shift_start_time_min: shift_start_time_min ?? '',
        shift_start_time_max: shift_start_time_max ?? '',
        willing_double_am_pm,
        willing_double_pm_midnight,
        willing_double_midnight_am,
        double_gap_minutes_acceptable: double_gap_minutes_acceptable ?? '',
        max_doubles_in_row: max_doubles_in_row ?? '',
        hide_posts_that_would_be_double,
    });

    const toggleDeskType = (value: string) => {
        const next = data.desired_desk_types.includes(value)
            ? data.desired_desk_types.filter((v) => v !== value)
            : [...data.desired_desk_types, value];
        setData('desired_desk_types', next);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Preferences" />

            <h1 className="sr-only">Preferences</h1>

            <SettingsLayout>
                <div className="space-y-8">
                    <Heading
                        variant="small"
                        title="Shift preferences"
                        description="Control which shifts appear on the Available page and how you want to work doubles (non-regulatory workgroups)."
                    />

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            put('/app/settings/preferences');
                        }}
                        className="space-y-8"
                    >
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Shift start time range (optional)</Label>
                            <p className="text-xs text-muted-foreground">
                                Only show shifts that start within this window. Leave blank for no limit. Times in your profile timezone.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Earliest</Label>
                                    <Input
                                        type="time"
                                        className="mt-0.5 w-32"
                                        value={data.shift_start_time_min}
                                        onChange={(e) => setData('shift_start_time_min', e.target.value)}
                                    />
                                </div>
                                <span className="text-muted-foreground pt-5">to</span>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Latest</Label>
                                    <Input
                                        type="time"
                                        className="mt-0.5 w-32"
                                        value={data.shift_start_time_max}
                                        onChange={(e) => setData('shift_start_time_max', e.target.value)}
                                    />
                                </div>
                            </div>
                            {(errors.shift_start_time_min || errors.shift_start_time_max) && (
                                <p className="text-sm text-destructive">{errors.shift_start_time_min ?? errors.shift_start_time_max}</p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium">Show me shifts for these desks</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Check the desk types you want to see on the Available page. Leave all unchecked to see all desks you&apos;re qualified for. Grouped by workgroup.
                                </p>
                            </div>
                            {desk_options_by_workgroup.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No desk types available for your workgroups yet.</p>
                            ) : (
                                <div className="space-y-5">
                                    {desk_options_by_workgroup.map((section) => (
                                        <div key={section.workgroup_id} className="rounded-lg border border-sidebar-border/70 bg-muted/10 p-4 dark:border-sidebar-border">
                                            <h3 className="text-sm font-semibold text-foreground mb-3">{section.workgroup_name}</h3>
                                            <div className="flex flex-wrap gap-4">
                                                {section.desk_type_options.map((opt) => (
                                                    <Label
                                                        key={opt.value}
                                                        className="flex items-center gap-2 font-normal cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={data.desired_desk_types.includes(opt.value)}
                                                            onCheckedChange={() => toggleDeskType(opt.value)}
                                                        />
                                                        <span className="text-sm">{opt.label}</span>
                                                    </Label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.desired_desk_types && (
                                <p className="text-sm text-destructive">{errors.desired_desk_types}</p>
                            )}
                        </div>

                        <div className="space-y-4 rounded-lg border border-sidebar-border/70 bg-muted/20 p-4 dark:border-sidebar-border">
                            <div>
                                <Label className="text-sm font-medium">Non-regulatory workgroups — doubles</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    If you&apos;re willing to work doubles, which combinations and what gap between shifts is acceptable.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-6">
                                <Label className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox
                                        checked={data.willing_double_am_pm}
                                        onCheckedChange={(c) => setData('willing_double_am_pm', !!c)}
                                    />
                                    <span className="text-sm">AM / PM</span>
                                </Label>
                                <Label className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox
                                        checked={data.willing_double_pm_midnight}
                                        onCheckedChange={(c) => setData('willing_double_pm_midnight', !!c)}
                                    />
                                    <span className="text-sm">PM / Mid</span>
                                </Label>
                                <Label className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox
                                        checked={data.willing_double_midnight_am}
                                        onCheckedChange={(c) => setData('willing_double_midnight_am', !!c)}
                                    />
                                    <span className="text-sm">Mid / AM</span>
                                </Label>
                            </div>
                            <div className="flex flex-wrap items-end gap-4">
                                <div>
                                    <Label className="text-xs">Max gap between shifts (minutes)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={1440}
                                        placeholder="e.g. 60"
                                        className="mt-0.5 w-28"
                                        value={data.double_gap_minutes_acceptable === '' ? '' : data.double_gap_minutes_acceptable}
                                        onChange={(e) => setData('double_gap_minutes_acceptable', e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground mt-0.5">e.g. 60 = 1 hour between end of first and start of next</p>
                                </div>
                                <div>
                                    <Label className="text-xs">Max doubles in a row</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={7}
                                        placeholder="e.g. 2"
                                        className="mt-0.5 w-24"
                                        value={data.max_doubles_in_row === '' ? '' : data.max_doubles_in_row}
                                        onChange={(e) => setData('max_doubles_in_row', e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            {(errors.double_gap_minutes_acceptable || errors.max_doubles_in_row) && (
                                <p className="text-sm text-destructive">{errors.double_gap_minutes_acceptable ?? errors.max_doubles_in_row}</p>
                            )}
                            <div className="pt-2 border-t border-sidebar-border/50">
                                <Label className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Checkbox
                                        checked={data.hide_posts_that_would_be_double}
                                        onCheckedChange={(c) => setData('hide_posts_that_would_be_double', !!c)}
                                    />
                                    <span className="text-sm">Hide posts that would be a double on the Available page</span>
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                    When on, giveaways or trades that would give you two shifts on the same day are hidden. Turn off to see them (they will show a &quot;Double&quot; badge).
                                </p>
                            </div>
                        </div>

                        {status && (
                            <p className="text-sm text-green-600 dark:text-green-400">{status}</p>
                        )}

                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving…' : 'Save preferences'}
                        </Button>
                    </form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
