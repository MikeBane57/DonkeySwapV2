import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/app/settings/profile' },
    { title: 'Qualifications', href: '/app/settings/qualifications' },
];

type QualificationOption = {
    id: number;
    code: string;
    label: string;
    selected: boolean;
};

type WorkgroupSection = {
    id: number;
    name: string;
    qualifications: QualificationOption[];
};

export default function Qualifications({
    workgroups = [],
    status,
}: {
    workgroups?: WorkgroupSection[];
    status?: string;
}) {
    const initialIds = workgroups.flatMap((wg) =>
        wg.qualifications.filter((q) => q.selected).map((q) => q.id),
    );
    const { data, setData, put, processing, errors } = useForm({
        qualification_ids: initialIds as number[],
    });

    const toggleQualification = (id: number) => {
        const next = data.qualification_ids.includes(id)
            ? data.qualification_ids.filter((x) => x !== id)
            : [...data.qualification_ids, id];
        setData('qualification_ids', next);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Qualifications" />

            <h1 className="sr-only">Qualifications</h1>

            <SettingsLayout>
                <div className="space-y-8">
                    <Heading
                        variant="small"
                        title="Qualifications"
                        description="Manage which qualifications you hold for each workgroup you belong to. You can only add or remove qualifications for your workgroups."
                    />

                    {workgroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            You are not in any workgroups yet. Contact an admin to be assigned to a workgroup; then you can manage your qualifications here.
                        </p>
                    ) : (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                put('/app/settings/qualifications');
                            }}
                            className="space-y-8"
                        >
                            {status && (
                                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                                    {status}
                                </p>
                            )}
                            {errors.qualification_ids && (
                                <p className="text-sm text-destructive">{errors.qualification_ids}</p>
                            )}
                            <div className="space-y-6">
                                {workgroups.map((wg) => (
                                    <div
                                        key={wg.id}
                                        className="rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border"
                                    >
                                        <h2 className="mb-3 text-sm font-semibold">{wg.name}</h2>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                                            {wg.qualifications.map((q) => (
                                                <label
                                                    key={q.id}
                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                >
                                                    <Checkbox
                                                        checked={data.qualification_ids.includes(q.id)}
                                                        onCheckedChange={() => toggleQualification(q.id)}
                                                        aria-label={q.label}
                                                    />
                                                    <span>
                                                        {q.label}
                                                        {q.code ? (
                                                            <span className="ml-1 text-muted-foreground">
                                                                ({q.code})
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {wg.qualifications.length === 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                No qualifications defined for this workgroup.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving…' : 'Save qualifications'}
                            </Button>
                        </form>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
