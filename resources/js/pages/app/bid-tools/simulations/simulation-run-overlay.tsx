import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export const SIMULATION_RUN_MESSAGES = [
    'Herding donkeys into seniority order…',
    'The senior donkey is reviewing the bid sheet…',
    'Aligning hooves with desk preferences…',
    'Asking who called Christmas off…',
    'Teaching donkeys to count minimum bid lines…',
    'Shuffling DS7 into the right pen…',
    'Negotiating with the hay allocation committee…',
    'Donkeys are comparing holiday scores…',
    'Checking personal dates against the grazing calendar…',
    'Waking up the relief donkeys…',
    'Convincing mid shifts to stop braying…',
    'One donkey is still thinking. Please hold…',
    'Straightening the picket line…',
] as const;

export const SIMULATION_COMPLETE_MESSAGE =
    'Simulation complete! The donkeys have picked their lines.';

export const SIMULATION_ERROR_MESSAGE =
    'The donkeys scattered. Check your bidders and try again.';

export type SimulationRunStatus = 'running' | 'complete' | 'error';

export function SimulationRunOverlay({
    visible,
    progress,
    message,
    status,
}: {
    visible: boolean;
    progress: number;
    message: string;
    status: SimulationRunStatus;
}) {
    if (!visible) {
        return null;
    }

    const clampedProgress = Math.max(0, Math.min(100, progress));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulation-run-title"
            aria-describedby="simulation-run-message"
        >
            <div className="w-full max-w-md rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="flex items-center gap-3">
                    {status === 'complete' ? (
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : status === 'error' ? (
                        <XCircle className="h-6 w-6 shrink-0 text-destructive" />
                    ) : (
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
                    )}
                    <h2
                        id="simulation-run-title"
                        className="text-lg font-semibold tracking-tight"
                    >
                        {status === 'complete'
                            ? 'Simulation complete'
                            : status === 'error'
                              ? 'Simulation failed'
                              : 'Running simulation'}
                    </h2>
                </div>

                <p
                    id="simulation-run-message"
                    className="mt-3 min-h-[3rem] text-sm leading-relaxed text-muted-foreground"
                >
                    {message}
                </p>

                <div className="mt-5 space-y-2">
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                                status === 'complete'
                                    ? 'bg-emerald-600 dark:bg-emerald-500'
                                    : status === 'error'
                                      ? 'bg-destructive'
                                      : 'bg-primary'
                            }`}
                            style={{ width: `${clampedProgress}%` }}
                        />
                    </div>
                    <p className="text-right text-xs text-muted-foreground tabular-nums">
                        {status === 'complete'
                            ? '100%'
                            : `${Math.round(clampedProgress)}%`}
                    </p>
                </div>
            </div>
        </div>
    );
}
