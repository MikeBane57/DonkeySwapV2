import { router, usePage } from '@inertiajs/react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { logClientError } from '@/lib/client-logger';
import { markSeen as markSeenRoute } from '@/routes/tutorial';
import { runDriverTour } from '@/tutorial/run-driver-tour';
import { pathForIntent, stepsForIntent } from '@/tutorial/steps';
import type {
    TutorialIntent,
    TutorialShared,
    WhatsNewItem,
} from '@/types/tutorial';

type RunIntentOptions = {
    markFeatureIds?: string[];
    afterComplete?: () => void;
};

type TutorialContextValue = {
    openIntentPicker: () => void;
    startTutorial: (intent: TutorialIntent, options?: RunIntentOptions) => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

const TUTORIAL_INTENTS = [
    'get-started',
    'my-schedule',
    'available-shifts',
    'looking-for-work',
    'notifications',
    'settings',
    'admin',
] as const satisfies readonly TutorialIntent[];

function isTutorialIntent(value: string): value is TutorialIntent {
    return (TUTORIAL_INTENTS as readonly string[]).includes(value);
}

export function useTutorialOptional(): TutorialContextValue | null {
    return useContext(TutorialContext);
}

export function useTutorial(): TutorialContextValue {
    const ctx = useContext(TutorialContext);
    if (!ctx) {
        throw new Error('useTutorial must be used within TutorialProvider');
    }
    return ctx;
}

function postMarkSeen(featureIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        if (featureIds.length === 0) {
            resolve();
            return;
        }
        router.post(
            markSeenRoute.url(),
            { feature_ids: featureIds },
            {
                preserveScroll: true,
                onFinish: () => resolve(),
                onError: (errors) => {
                    logClientError('tutorial.markSeen', errors);
                    reject(errors);
                },
            },
        );
    });
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
    const page = usePage();
    const tutorial = page.props.tutorial as TutorialShared | null | undefined;
    const appName = page.props.name as string;
    const user = page.props.auth?.user;

    const destroyTourRef = useRef<(() => void) | null>(null);
    const firstLoginViaTourRef = useRef(false);
    const firstLoginDismissedRef = useRef(false);

    const [intentPickerOpen, setIntentPickerOpen] = useState(false);
    const [blockWhatsNew, setBlockWhatsNew] = useState(
        () => !!tutorial?.first_login_tutorial,
    );
    const [whatsNewLocalDismissed, setWhatsNewLocalDismissed] = useState(false);

    const whatsNewItems = tutorial?.whats_new ?? [];
    const showWhatsNew =
        !blockWhatsNew && !whatsNewLocalDismissed && whatsNewItems.length > 0;

    const [firstLoginOpen, setFirstLoginOpen] = useState(
        () => !!tutorial?.first_login_tutorial,
    );

    useEffect(() => {
        return () => {
            destroyTourRef.current?.();
        };
    }, []);

    const dismissFirstLogin = useCallback(() => {
        if (firstLoginDismissedRef.current) {
            return;
        }
        firstLoginDismissedRef.current = true;
        setFirstLoginOpen(false);
        setBlockWhatsNew(false);
        void postMarkSeen(['get-started']).catch((e) =>
            logClientError('tutorial.firstLogin.skip', e),
        );
    }, []);

    const startTutorial = useCallback(
        (intent: TutorialIntent, options?: RunIntentOptions) => {
            const targetPath = pathForIntent(intent);
            const normalizedPath =
                window.location.pathname.replace(/\/$/, '') || '/';
            const normalizedTarget = targetPath.replace(/\/$/, '') || '/';
            const needsNav = normalizedPath !== normalizedTarget;

            const launch = () => {
                destroyTourRef.current?.();
                const steps = stepsForIntent(intent);
                destroyTourRef.current = runDriverTour(steps, () => {
                    destroyTourRef.current = null;
                    const ids = options?.markFeatureIds;
                    if (ids?.length) {
                        void postMarkSeen(ids).catch((e) =>
                            logClientError('tutorial.markSeen.afterTour', e),
                        );
                    }
                    options?.afterComplete?.();
                });
            };

            if (needsNav) {
                router.visit(targetPath, {
                    preserveScroll: true,
                    onFinish: () => {
                        window.setTimeout(launch, 150);
                    },
                });
            } else {
                window.setTimeout(launch, 50);
            }
        },
        [],
    );

    const openIntentPicker = useCallback(() => {
        setIntentPickerOpen(true);
    }, []);

    const contextValue = useMemo<TutorialContextValue>(
        () => ({ openIntentPicker, startTutorial }),
        [openIntentPicker, startTutorial],
    );

    const handleFirstLoginSkip = useCallback(() => {
        dismissFirstLogin();
    }, [dismissFirstLogin]);

    const handleFirstLoginStart = useCallback(() => {
        firstLoginViaTourRef.current = true;
        setFirstLoginOpen(false);
        setBlockWhatsNew(false);
        startTutorial('get-started', {
            markFeatureIds: ['get-started'],
        });
    }, [startTutorial]);

    const handleFirstLoginOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                if (firstLoginViaTourRef.current) {
                    firstLoginViaTourRef.current = false;
                    return;
                }
                dismissFirstLogin();
            }
        },
        [dismissFirstLogin],
    );

    const handleWhatsNewGotIt = useCallback(() => {
        const ids = whatsNewItems.map((w) => w.id);
        setWhatsNewLocalDismissed(true);
        void postMarkSeen(ids).catch((e) =>
            logClientError('tutorial.whatsNew.gotIt', e),
        );
    }, [whatsNewItems]);

    const handleWhatsNewRunTour = useCallback(
        (item: WhatsNewItem) => {
            if (!item.intent || !isTutorialIntent(item.intent)) return;
            setWhatsNewLocalDismissed(true);
            startTutorial(item.intent, {
                markFeatureIds: [item.id],
            });
        },
        [startTutorial],
    );

    const handleWhatsNewRunAll = useCallback(() => {
        const withIntent = whatsNewItems.filter((w) => w.intent);
        const allIds = whatsNewItems.map((w) => w.id);
        if (withIntent.length === 0) {
            void handleWhatsNewGotIt();
            return;
        }
        setWhatsNewLocalDismissed(true);
        let index = 0;
        const runNext = () => {
            if (index >= withIntent.length) {
                void postMarkSeen(allIds).catch((e) =>
                    logClientError('tutorial.runAll.markSeen', e),
                );
                return;
            }
            const item = withIntent[index]!;
            index += 1;
            if (!item.intent || !isTutorialIntent(item.intent)) {
                runNext();
                return;
            }
            startTutorial(item.intent, {
                afterComplete: runNext,
            });
        };
        runNext();
    }, [handleWhatsNewGotIt, startTutorial, whatsNewItems]);

    const handleWhatsNewOpenChange = useCallback((open: boolean) => {
        if (!open) {
            setWhatsNewLocalDismissed(true);
        }
    }, []);

    const isAdmin = user?.role === 'admin';

    const intentChoices = useMemo(
        () =>
            [
                { id: 'get-started' as const, label: 'Get started (overview)' },
                { id: 'my-schedule' as const, label: 'My Schedule' },
                { id: 'available-shifts' as const, label: 'Available shifts' },
                {
                    id: 'looking-for-work' as const,
                    label: 'Looking for work',
                },
                { id: 'notifications' as const, label: 'Notifications' },
                { id: 'settings' as const, label: 'Settings' },
                ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),
            ] as const,
        [isAdmin],
    );

    return (
        <TutorialContext.Provider value={contextValue}>
            {children}

            <Dialog
                open={firstLoginOpen}
                onOpenChange={handleFirstLoginOpenChange}
            >
                <DialogContent showCloseButton={false} className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Welcome to {appName}</DialogTitle>
                        <DialogDescription>
                            Take a quick tour of the sidebar and main areas, or
                            skip and explore on your own. You can always run
                            tutorials again from your profile menu.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleFirstLoginSkip}
                        >
                            Skip
                        </Button>
                        <Button type="button" onClick={handleFirstLoginStart}>
                            Start tour
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showWhatsNew} onOpenChange={handleWhatsNewOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>What&apos;s new</DialogTitle>
                        <DialogDescription>
                            Here are recent updates. Run a focused tour or mark
                            everything as seen when you are done.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                        {whatsNewItems.map((item) => (
                            <li
                                key={item.id}
                                className="rounded-lg border border-border bg-muted/30 p-3"
                            >
                                <p className="font-medium text-foreground">
                                    {item.title}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {item.description}
                                </p>
                                {item.intent && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() =>
                                            handleWhatsNewRunTour(item)
                                        }
                                    >
                                        Run tour
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleWhatsNewGotIt}
                        >
                            Got it
                        </Button>
                        {whatsNewItems.some((w) => w.intent) && (
                            <Button
                                type="button"
                                variant="default"
                                onClick={handleWhatsNewRunAll}
                            >
                                Run all tours
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={intentPickerOpen} onOpenChange={setIntentPickerOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Run tutorial</DialogTitle>
                        <DialogDescription>
                            Choose what you want to learn about. We&apos;ll jump
                            to the right page if needed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        {intentChoices.map((choice) => (
                            <Button
                                key={choice.id}
                                type="button"
                                variant="outline"
                                className="h-auto justify-start py-3 text-left font-normal"
                                onClick={() => {
                                    setIntentPickerOpen(false);
                                    startTutorial(choice.id);
                                }}
                            >
                                {choice.label}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </TutorialContext.Provider>
    );
}
