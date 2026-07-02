import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { personalDatesForSave } from '@/pages/app/bid-tools/personal-dates-editor';
import { BidderIdentityFields } from '@/pages/app/bid-tools/simulations/bidder-identity-fields';
import {
    BidderProfileFields,
    emptyBidderProfile,
    profileFromTemplate,
} from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import type { BidderProfile } from '@/pages/app/bid-tools/simulations/bidder-profile-fields';
import {
    ProfileSourcePicker
    
    
} from '@/pages/app/bid-tools/simulations/profile-source-picker';
import type {ProfileSource, ProfileTemplate} from '@/pages/app/bid-tools/simulations/profile-source-picker';
import type { BreadcrumbItem } from '@/types';

type Participant = {
    id: number;
    display_name: string;
    seniority_rank: number;
    minimum_bid_lines: number;
    bid_scenario_id: number;
    profile: BidderProfile;
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
    lines,
}: {
    simulationId: number;
    participant: Participant;
    profileDefaults: BidderProfile;
    profileTemplates: ProfileTemplate[];
    lines: LinePickerRow[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        display_name: participant.display_name,
        seniority_rank: participant.seniority_rank,
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
            { preserveScroll: true },
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
                        displayNameError={form.errors.display_name}
                        seniorityRankError={form.errors.seniority_rank}
                    />

                    {profileTemplates.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor={`p-${participant.id}-replace-profile`}>
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
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Keeps this bidder&apos;s vacation bank and
                                seniority; copies holidays, desk, and ranking.
                            </p>
                        </div>
                    )}

                    <BidderProfileFields
                        idPrefix={`p-${participant.id}`}
                        rankDefaults={profileDefaults}
                        value={form.data.profile}
                        onChange={(profile) => form.setData('profile', profile)}
                        scenarioId={participant.bid_scenario_id}
                        lines={lines}
                        hideVacationBank
                    />

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.processing}
                        >
                            Save bidder
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/simulations/${simulationId}/participants/${participant.id}/recommendations`}
                            >
                                Suggested bid order
                            </Link>
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

export default function BidSimulationEdit({
    simulation,
    profile_defaults: profileDefaults,
    profile_templates: profileTemplates,
    participants,
    lines,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
        import_title: string | null;
    };
    profile_defaults: BidderProfile;
    profile_templates: ProfileTemplate[];
    participants: Participant[];
    lines: LinePickerRow[];
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();
    const [profileSource, setProfileSource] = useState<ProfileSource>('new');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
        null,
    );

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        {
            title: simulation.name,
            href: `/app/bid-tools/simulations/${simulation.id}`,
        },
        { title: 'Manage', href: '#' },
    ];

    const nameForm = useForm({ name: simulation.name });
    const addForm = useForm({
        display_name: '',
        seniority_rank: participants.length + 1,
        profile: emptyBidderProfile(profileDefaults),
    });

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
                        seniority_rank: participants.length + 2,
                        profile: emptyBidderProfile(profileDefaults),
                    });
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Manage · ${simulation.name}`} />
            <div className="mx-auto max-w-5xl space-y-8 p-4 pb-12">
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
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/simulations/${simulation.id}`}
                            >
                                View simulation
                            </Link>
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
                            Delete simulation
                        </Button>
                    </div>
                </div>

                {page.props.flash?.success && (
                    <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                        {page.props.flash.success}
                    </p>
                )}

                <section className="space-y-3 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Simulation name</h2>
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            nameForm.put(
                                `/app/bid-tools/simulations/${simulation.id}`,
                            );
                        }}
                    >
                        <div className="min-w-[200px] flex-1 space-y-1">
                            <Input
                                value={nameForm.data.name}
                                onChange={(e) =>
                                    nameForm.setData('name', e.target.value)
                                }
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={nameForm.processing}
                        >
                            Save name
                        </Button>
                    </form>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Bidders ({participants.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Seniority #1 picks first and only needs 1 line on their
                        bid sheet. #20 needs at least 20 lines ranked. Expand a
                        bidder to edit their preferences inline.
                    </p>
                    {participants.length > 0 && (
                        <div className="space-y-2">
                            {participants.map((p) => (
                                <ParticipantEditor
                                    key={p.id}
                                    simulationId={simulation.id}
                                    participant={p}
                                    profileDefaults={profileDefaults}
                                    profileTemplates={profileTemplates}
                                    lines={lines}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Add bidder</h2>
                    <form className="space-y-4" onSubmit={addParticipant}>
                        <BidderIdentityFields
                            idPrefix="new-bidder"
                            displayName={addForm.data.display_name}
                            seniorityRank={addForm.data.seniority_rank}
                            vacationBank={addForm.data.profile.vacation_bank}
                            onDisplayNameChange={(display_name) =>
                                addForm.setData('display_name', display_name)
                            }
                            onSeniorityRankChange={(seniority_rank) =>
                                addForm.setData('seniority_rank', seniority_rank)
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
                            displayNameError={addForm.errors.display_name}
                            seniorityRankError={addForm.errors.seniority_rank}
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
                        />
                        <p className="text-xs text-muted-foreground">
                            Save the bidder first to preview line rankings below
                            their profile.
                        </p>

                        <Button type="submit" disabled={addForm.processing}>
                            Add bidder
                        </Button>
                    </form>
                </section>
            </div>
        </AppLayout>
    );
}
