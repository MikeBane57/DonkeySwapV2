import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, Copy, Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import type {
    DeskBucketMapping,
    DeskBucketReferenceRow,
} from '@/pages/app/bid-tools/desk-bucket-mapping-utils';
import {
    ImportFileMappingSection,
    lineDeskBucketsFromStorage,
    lineDeskBucketsToStorage,
} from '@/pages/app/bid-tools/import-file-mapping-section';
import { personalDatesForSave } from '@/pages/app/bid-tools/personal-dates-editor';
import { BidderIdentityFields } from '@/pages/app/bid-tools/simulations/bidder-identity-fields';
import {
    BidderProfileFields,
    emptyBidderProfile,
    profileFromTemplate,
} from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import type { BidderProfile } from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import { ParticipantRecommendationsPanel } from '@/pages/app/bid-tools/simulations/participant-recommendations-panel';
import { ProfileSourcePicker } from '@/pages/app/bid-tools/simulations/profile-source-picker';
import type {
    ProfileSource,
    ProfileTemplate,
} from '@/pages/app/bid-tools/simulations/profile-source-picker';
import type { BreadcrumbItem } from '@/types';

type Participant = {
    id: number;
    display_name: string;
    seniority_rank: number;
    skips_bid: boolean;
    minimum_bid_lines: number;
    bid_scenario_id: number;
    profile: BidderProfile;
};

type ResultRow = {
    participant_id: number;
    display_name: string;
    seniority_rank: number;
    bid_line_id: number | null;
    line_num: string | null;
    desk_group: string | null;
    start_time: string | null;
    preference_rank: number | null;
    total: number | null;
    message: string | null;
    skipped?: boolean;
};

function sanitizeProfile(profile: BidderProfile): BidderProfile {
    return {
        ...profile,
        personal_dates: personalDatesForSave(profile.personal_dates),
    };
}

function syncProfileVacationBank(
    profile: BidderProfile,
    vacationBank: number,
): BidderProfile {
    return {
        ...profile,
        vacation_bank: vacationBank,
    };
}

function ParticipantEditor({
    simulationId,
    participant,
    profileDefaults,
    profileTemplates,
    simulationName,
    bidYear,
    otherParticipants,
}: {
    simulationId: number;
    participant: Participant;
    profileDefaults: BidderProfile;
    profileTemplates: ProfileTemplate[];
    simulationName: string;
    bidYear: number;
    otherParticipants: Participant[];
}) {
    const [open, setOpen] = useState(false);
    const [recommendationsRefreshKey, setRecommendationsRefreshKey] =
        useState(0);
    const form = useForm({
        display_name: participant.display_name,
        seniority_rank: participant.seniority_rank,
        skips_bid: participant.skips_bid,
        profile: participant.profile,
    });

    const applyTemplate = (templateId: number) => {
        const template = profileTemplates.find((row) => row.id === templateId);
        if (!template) {
            return;
        }

        form.setData(
            'profile',
            profileFromTemplate(template.profile, {
                vacation_bank: form.data.profile.vacation_bank,
            }),
        );
    };

    const save = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            profile: sanitizeProfile(
                syncProfileVacationBank(
                    data.profile,
                    data.profile.vacation_bank,
                ),
            ),
        }));
        form.put(
            `/app/bid-tools/simulations/${simulationId}/participants/${participant.id}`,
            {
                preserveScroll: true,
                onSuccess: () => setRecommendationsRefreshKey((key) => key + 1),
            },
        );
    };

    const remove = () => {
        if (
            !confirm(`Remove ${participant.display_name} from this simulation?`)
        ) {
            return;
        }
        router.delete(
            `/app/bid-tools/simulations/${simulationId}/participants/${participant.id}`,
            { preserveScroll: true },
        );
    };

    return (
        <div className="rounded-lg border border-sidebar-border/70">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
                onClick={() => setOpen((v) => !v)}
            >
                <span>
                    <span className="font-medium">
                        #{participant.seniority_rank} {participant.display_name}
                    </span>
                    {participant.skips_bid && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            passes
                        </span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                        min {participant.minimum_bid_lines} line
                        {participant.minimum_bid_lines === 1 ? '' : 's'}
                    </span>
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <form
                    className="space-y-4 border-t border-sidebar-border/50 p-3"
                    onSubmit={save}
                >
                    <BidderIdentityFields
                        idPrefix={`p-${participant.id}`}
                        displayName={form.data.display_name}
                        seniorityRank={form.data.seniority_rank}
                        vacationBank={form.data.profile.vacation_bank}
                        skipsBid={form.data.skips_bid}
                        onDisplayNameChange={(display_name) =>
                            form.setData('display_name', display_name)
                        }
                        onSeniorityRankChange={(seniority_rank) =>
                            form.setData('seniority_rank', seniority_rank)
                        }
                        onVacationBankChange={(vacation_bank) =>
                            form.setData(
                                'profile',
                                syncProfileVacationBank(
                                    form.data.profile,
                                    vacation_bank,
                                ),
                            )
                        }
                        onSkipsBidChange={(skips_bid) =>
                            form.setData('skips_bid', skips_bid)
                        }
                        displayNameError={form.errors.display_name}
                        seniorityRankError={form.errors.seniority_rank}
                        existingBidders={otherParticipants.map((p) => ({
                            seniority_rank: p.seniority_rank,
                            display_name: p.display_name,
                        }))}
                        seniorityMode="reposition"
                        originalSeniorityRank={participant.seniority_rank}
                    />

                    {profileTemplates.length > 0 && (
                        <div className="space-y-2">
                            <Label
                                htmlFor={`p-${participant.id}-replace-profile`}
                            >
                                Replace preferences from saved profile
                            </Label>
                            <select
                                id={`p-${participant.id}-replace-profile`}
                                className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                defaultValue=""
                                onChange={(e) => {
                                    const templateId = Number(e.target.value);
                                    if (templateId > 0) {
                                        applyTemplate(templateId);
                                    }
                                    e.currentTarget.value = '';
                                }}
                            >
                                <option value="" disabled>
                                    Choose a saved profile…
                                </option>
                                {profileTemplates.map((template) => (
                                    <option
                                        key={template.id}
                                        value={template.id}
                                    >
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <BidderProfileFields
                        idPrefix={`p-${participant.id}`}
                        rankDefaults={profileDefaults}
                        value={form.data.profile}
                        onChange={(profile) => form.setData('profile', profile)}
                        hideVacationBank
                        hideLinePreview
                    />

                    <p className="text-xs text-muted-foreground">
                        Desk group changes apply after you click Save bidder.
                        Drag the bid order below and click Save order to
                        override the computed ranking for simulation picks.
                    </p>

                    <ParticipantRecommendationsPanel
                        simulationId={simulationId}
                        participantId={participant.id}
                        displayName={participant.display_name}
                        seniorityRank={participant.seniority_rank}
                        minimumBidLines={participant.minimum_bid_lines}
                        skipsBid={form.data.skips_bid}
                        simulationName={simulationName}
                        bidYear={bidYear}
                        refreshKey={recommendationsRefreshKey}
                    />

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.processing}
                        >
                            Save bidder
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={remove}
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default function BidSimulationShow({
    simulation,
    profile_defaults: profileDefaults,
    profile_templates: profileTemplates,
    participants,
    desk_catalog: deskCatalog,
    desk_bucket_reference: deskBucketReference,
    lines,
    results,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
        import_title: string | null;
        last_run_at: string | null;
        desk_bucket_mappings: DeskBucketMapping[];
        line_desk_buckets: { bid_line_id: number; bucket: string }[];
    };
    profile_defaults: BidderProfile;
    profile_templates: ProfileTemplate[];
    participants: Participant[];
    desk_catalog: { key: string; label: string }[];
    desk_bucket_reference: DeskBucketReferenceRow[];
    lines: LinePickerRow[];
    results: ResultRow[] | null;
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();
    const [running, setRunning] = useState(false);
    const [profileSource, setProfileSource] = useState<ProfileSource>('new');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
        null,
    );
    const [deskBucketMappings, setDeskBucketMappings] = useState<
        DeskBucketMapping[]
    >(simulation.desk_bucket_mappings ?? []);
    const [lineDeskBuckets, setLineDeskBuckets] = useState<
        Record<number, string>
    >(() => lineDeskBucketsFromStorage(simulation.line_desk_buckets));

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        { title: simulation.name, href: '#' },
    ];

    const simForm = useForm({
        name: simulation.name,
        desk_bucket_mappings: deskBucketMappings,
        line_desk_buckets: lineDeskBucketsToStorage(lineDeskBuckets),
    });

    const addForm = useForm({
        display_name: '',
        seniority_rank: participants.length + 1,
        skips_bid: false,
        profile: emptyBidderProfile(profileDefaults),
    });

    useEffect(() => {
        addForm.setData('seniority_rank', participants.length + 1);
    }, [participants.length]);

    const saveSimulation = (e: React.FormEvent) => {
        e.preventDefault();
        simForm.setData({
            name: simForm.data.name,
            desk_bucket_mappings: deskBucketMappings,
            line_desk_buckets: lineDeskBucketsToStorage(lineDeskBuckets),
        });
        simForm.put(`/app/bid-tools/simulations/${simulation.id}`, {
            preserveScroll: true,
        });
    };

    const runSimulation = () => {
        setRunning(true);
        router.post(
            `/app/bid-tools/simulations/${simulation.id}/run`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setRunning(false),
            },
        );
    };

    const resetAddProfile = (source: ProfileSource) => {
        const vacationBank = addForm.data.profile.vacation_bank;
        if (source === 'new') {
            addForm.setData(
                'profile',
                syncProfileVacationBank(
                    emptyBidderProfile(profileDefaults),
                    vacationBank,
                ),
            );
            setSelectedTemplateId(null);

            return;
        }

        const template =
            profileTemplates.find((row) => row.id === selectedTemplateId) ??
            profileTemplates[0];

        if (!template) {
            return;
        }

        setSelectedTemplateId(template.id);
        addForm.setData(
            'profile',
            profileFromTemplate(template.profile, {
                vacation_bank: vacationBank,
            }),
        );
    };

    const handleProfileSourceChange = (source: ProfileSource) => {
        setProfileSource(source);
        resetAddProfile(source);
    };

    const handleTemplateSelect = (templateId: number) => {
        setSelectedTemplateId(templateId);
        const template = profileTemplates.find((row) => row.id === templateId);
        if (!template) {
            return;
        }

        addForm.setData(
            'profile',
            profileFromTemplate(template.profile, {
                vacation_bank: addForm.data.profile.vacation_bank,
            }),
        );
    };

    const addParticipant = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.transform((data) => ({
            ...data,
            profile: sanitizeProfile(
                syncProfileVacationBank(
                    data.profile,
                    data.profile.vacation_bank,
                ),
            ),
        }));
        addForm.post(
            `/app/bid-tools/simulations/${simulation.id}/participants`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    addForm.reset();
                    setProfileSource('new');
                    setSelectedTemplateId(null);
                    addForm.setData({
                        display_name: '',
                        seniority_rank: participants.length + 1,
                        skips_bid: false,
                        profile: emptyBidderProfile(profileDefaults),
                    });
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={simulation.name} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {simulation.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {simulation.bid_year}
                            {simulation.import_title
                                ? ` · ${simulation.import_title}`
                                : ''}
                            {simulation.last_run_at && (
                                <span>
                                    {' '}
                                    · simulated{' '}
                                    {new Date(
                                        simulation.last_run_at,
                                    ).toLocaleString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            type="button"
                            disabled={participants.length === 0 || running}
                            onClick={runSimulation}
                        >
                            <Play className="mr-2 h-4 w-4" />
                            Run simulation
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() =>
                                router.post(
                                    `/app/bid-tools/simulations/${simulation.id}/duplicate`,
                                )
                            }
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                                if (
                                    confirm(
                                        `Delete "${simulation.name}" and all its bidders? This cannot be undone.`,
                                    )
                                ) {
                                    router.delete(
                                        `/app/bid-tools/simulations/${simulation.id}`,
                                    );
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </div>

                {page.props.flash?.success && (
                    <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                        {page.props.flash.success}
                    </p>
                )}
                {page.props.flash?.error && (
                    <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                        {page.props.flash.error}
                    </p>
                )}

                <form onSubmit={saveSimulation} className="space-y-4">
                    <BidToolsCollapsibleSection
                        title="Simulation settings"
                        summary={simForm.data.name}
                        defaultOpen={false}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="simulation-name">Name</Label>
                            <Input
                                id="simulation-name"
                                value={simForm.data.name}
                                onChange={(e) =>
                                    simForm.setData('name', e.target.value)
                                }
                            />
                        </div>
                    </BidToolsCollapsibleSection>

                    <ImportFileMappingSection
                        deskCatalog={deskCatalog}
                        deskBucketReference={deskBucketReference}
                        lines={lines}
                        deskBucketMappings={deskBucketMappings}
                        lineDeskBuckets={lineDeskBuckets}
                        onDeskBucketMappingsChange={setDeskBucketMappings}
                        onLineDeskBucketsChange={setLineDeskBuckets}
                    />

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={simForm.processing}
                        >
                            Save simulation settings
                        </Button>
                    </div>
                </form>

                <BidToolsCollapsibleSection
                    title="Bidders & recommended order"
                    summary={`${participants.length} bidder${participants.length === 1 ? '' : 's'}`}
                    defaultOpen={false}
                >
                    <p className="text-sm text-muted-foreground">
                        Seniority #1 picks first. Expand a bidder to edit
                        preferences and view their suggested bid order.
                    </p>
                    {participants.length > 0 ? (
                        <div className="space-y-2">
                            {participants.map((p) => (
                                <ParticipantEditor
                                    key={p.id}
                                    simulationId={simulation.id}
                                    participant={p}
                                    profileDefaults={profileDefaults}
                                    profileTemplates={profileTemplates}
                                    simulationName={simulation.name}
                                    bidYear={simulation.bid_year}
                                    otherParticipants={participants.filter(
                                        (row) => row.id !== p.id,
                                    )}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No bidders yet. Add one below.
                        </p>
                    )}
                </BidToolsCollapsibleSection>

                <BidToolsCollapsibleSection
                    title="Add bidder"
                    summary="New participant"
                    defaultOpen={false}
                >
                    <form className="space-y-4" onSubmit={addParticipant}>
                        <BidderIdentityFields
                            idPrefix="new-bidder"
                            displayName={addForm.data.display_name}
                            seniorityRank={addForm.data.seniority_rank}
                            vacationBank={addForm.data.profile.vacation_bank}
                            skipsBid={addForm.data.skips_bid}
                            onDisplayNameChange={(display_name) =>
                                addForm.setData('display_name', display_name)
                            }
                            onSeniorityRankChange={(seniority_rank) =>
                                addForm.setData(
                                    'seniority_rank',
                                    seniority_rank,
                                )
                            }
                            onVacationBankChange={(vacation_bank) =>
                                addForm.setData(
                                    'profile',
                                    syncProfileVacationBank(
                                        addForm.data.profile,
                                        vacation_bank,
                                    ),
                                )
                            }
                            onSkipsBidChange={(skips_bid) =>
                                addForm.setData('skips_bid', skips_bid)
                            }
                            displayNameError={addForm.errors.display_name}
                            seniorityRankError={addForm.errors.seniority_rank}
                            existingBidders={participants.map((p) => ({
                                seniority_rank: p.seniority_rank,
                                display_name: p.display_name,
                            }))}
                            seniorityMode="insert"
                        />

                        <ProfileSourcePicker
                            idPrefix="new-bidder"
                            source={profileSource}
                            onSourceChange={handleProfileSourceChange}
                            templates={profileTemplates}
                            selectedTemplateId={selectedTemplateId}
                            onTemplateSelect={handleTemplateSelect}
                        />

                        <BidderProfileFields
                            idPrefix="new-bidder"
                            rankDefaults={profileDefaults}
                            value={addForm.data.profile}
                            onChange={(profile) =>
                                addForm.setData('profile', profile)
                            }
                            hideVacationBank
                            hideLinePreview
                        />

                        <Button type="submit" disabled={addForm.processing}>
                            Add bidder
                        </Button>
                    </form>
                </BidToolsCollapsibleSection>

                {results && results.length > 0 && (
                    <BidToolsCollapsibleSection
                        title="Simulation results"
                        summary={`${results.length} bidders`}
                        defaultOpen={false}
                    >
                        <p className="text-sm text-muted-foreground">
                            Each bidder picks their top available line in
                            seniority order.
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2">#</th>
                                        <th className="p-2">Bidder</th>
                                        <th className="p-2">Gets line</th>
                                        <th className="p-2">Group</th>
                                        <th className="p-2">Start</th>
                                        <th className="p-2">Pref #</th>
                                        <th className="p-2">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row) => (
                                        <tr
                                            key={row.participant_id}
                                            className={`border-b border-sidebar-border/40 ${row.skipped ? 'bg-muted/30' : ''}`}
                                        >
                                            <td className="p-2 font-medium">
                                                {row.seniority_rank}
                                            </td>
                                            <td className="p-2">
                                                {row.display_name}
                                            </td>
                                            <td className="p-2 font-mono text-xs">
                                                {row.line_num ?? (
                                                    <span className="text-muted-foreground">
                                                        {row.message ?? '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                {row.desk_group ?? '—'}
                                            </td>
                                            <td className="p-2 text-xs">
                                                {row.start_time ?? '—'}
                                            </td>
                                            <td className="p-2">
                                                {row.preference_rank ?? '—'}
                                            </td>
                                            <td className="p-2">
                                                {row.total ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </BidToolsCollapsibleSection>
                )}
            </div>
        </AppLayout>
    );
}
