import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: edit(),
    },
];

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Profile information"
                        description="Update your name, email, and primary contact. At least one contact method (phone or email) is required. Choose how you prefer to be reached when others respond to your posts."
                    />

                    <Form
                        {...ProfileController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>

                                    <Input
                                        id="name"
                                        className="mt-1 block w-full"
                                        defaultValue={auth.user.name}
                                        name="name"
                                        required
                                        autoComplete="name"
                                        placeholder="Full name"
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.name}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email address</Label>

                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={auth.user.email}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder="Email address"
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.email}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="employee_id">
                                        Employee ID
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Enter your Employee ID without the E
                                        (e.g. 121883).
                                    </p>
                                    <Input
                                        id="employee_id"
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            (
                                                auth.user as {
                                                    employee_id?: string;
                                                }
                                            )?.employee_id ?? ''
                                        }
                                        name="employee_id"
                                        required
                                        autoComplete="off"
                                        placeholder="e.g. 121883"
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errors.employee_id}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="preferred_contact_method">
                                        Preferred contact method
                                    </Label>
                                    <select
                                        id="preferred_contact_method"
                                        name="preferred_contact_method"
                                        required
                                        defaultValue={
                                            (
                                                auth.user as {
                                                    preferred_contact_method?: string;
                                                }
                                            )?.preferred_contact_method ??
                                            'email'
                                        }
                                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        <option value="email">Email</option>
                                        <option value="call">Call</option>
                                        <option value="text">Text</option>
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        How others should reach you when
                                        responding to your swap posts. If Call
                                        or Text, phone number is required.
                                    </p>
                                    <InputError
                                        className="mt-2"
                                        message={
                                            errors.preferred_contact_method
                                        }
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            (auth.user as { phone?: string })
                                                ?.phone ?? ''
                                        }
                                        name="phone"
                                        autoComplete="tel"
                                        placeholder="e.g. 555-123-4567"
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errors.phone}
                                    />
                                </div>

                                {mustVerifyEmail &&
                                    auth.user.email_verified_at === null && (
                                        <div>
                                            <p className="-mt-4 text-sm text-muted-foreground">
                                                Your email address is
                                                unverified.{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                                >
                                                    Click here to resend the
                                                    verification email.
                                                </Link>
                                            </p>

                                            {status ===
                                                'verification-link-sent' && (
                                                <div className="mt-2 text-sm font-medium text-green-600">
                                                    A new verification link has
                                                    been sent to your email
                                                    address.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                <div className="flex items-center gap-4">
                                    <Button
                                        disabled={processing}
                                        data-test="update-profile-button"
                                    >
                                        Save
                                    </Button>

                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition ease-in-out"
                                        enterFrom="opacity-0"
                                        leave="transition ease-in-out"
                                        leaveTo="opacity-0"
                                    >
                                        <p className="text-sm text-neutral-600">
                                            Saved
                                        </p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
