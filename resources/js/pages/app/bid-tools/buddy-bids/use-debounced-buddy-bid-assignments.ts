import { useCallback, useEffect, useRef, useState } from 'react';
import { logClientError } from '@/lib/client-logger';
import { getCsrfToken } from '@/lib/csrf';
import type {
    BuddyBidCalendarView,
    OverlapAssignmentsByDate,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import {
    applyLocalAssignments,
    assignmentsFromCalendar,
    calendarAssignmentsFingerprint,
    BUDDY_BID_AUTO_SAVE_MS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import type { OverlapDayAssignment } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-overlap-assignment';
import {
    assignmentsEqual,
    overlapAssignmentToApi,
    pendingOverlapAssignment,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-overlap-assignment';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function useDebouncedBuddyBidAssignments({
    planId,
    calendar,
}: {
    planId: number;
    calendar: BuddyBidCalendarView;
}) {
    const [assignments, setAssignments] = useState(() =>
        assignmentsFromCalendar(calendar),
    );
    const [dirtyDates, setDirtyDates] = useState<Set<string>>(() => new Set());
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const assignmentsRef = useRef(assignments);
    const dirtyDatesRef = useRef(dirtyDates);
    const saveTimerRef = useRef<number | null>(null);
    const serverAssignmentsFingerprintRef = useRef(
        calendarAssignmentsFingerprint(calendar),
    );

    assignmentsRef.current = assignments;
    dirtyDatesRef.current = dirtyDates;

    const clearSaveTimer = useCallback(() => {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const syncAssignmentsFromServerCalendar = useCallback(() => {
        serverAssignmentsFingerprintRef.current =
            calendarAssignmentsFingerprint(calendar);
        setAssignments(assignmentsFromCalendar(calendar));
        setDirtyDates(new Set());
        setSaveState('idle');
        setSaveError(null);
        clearSaveTimer();
    }, [calendar, clearSaveTimer]);

    useEffect(() => {
        const nextFingerprint = calendarAssignmentsFingerprint(calendar);
        if (nextFingerprint !== serverAssignmentsFingerprintRef.current) {
            syncAssignmentsFromServerCalendar();
        }
    }, [calendar, syncAssignmentsFromServerCalendar]);

    const saveNow = useCallback(async (): Promise<boolean> => {
        const datesToSave = Array.from(dirtyDatesRef.current);
        if (datesToSave.length === 0) {
            return true;
        }

        clearSaveTimer();
        setSaveState('saving');
        setSaveError(null);

        try {
            const response = await fetch(
                `/app/bid-tools/buddy-bids/${planId}/assignments`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        assignments: datesToSave.map((date) => ({
                            date,
                            ...overlapAssignmentToApi(
                                assignmentsRef.current[date] ??
                                    pendingOverlapAssignment(),
                            ),
                        })),
                    }),
                },
            );

            if (!response.ok) {
                if (response.status === 419) {
                    throw new Error('Session expired (419)');
                }

                throw new Error(`Save failed (${response.status})`);
            }

            setDirtyDates((current) => {
                const next = new Set(current);
                for (const date of datesToSave) {
                    next.delete(date);
                }
                return next;
            });
            setSaveState('saved');
            return true;
        } catch (error) {
            logClientError('buddy-bids.assignments.save', error);
            const message =
                error instanceof Error && error.message.includes('419')
                    ? 'Session expired. Refresh the page and try again.'
                    : 'Could not save overlap assignments. Try again.';
            setSaveError(message);
            setSaveState('error');
            return false;
        }
    }, [clearSaveTimer, planId]);

    const scheduleSave = useCallback(() => {
        clearSaveTimer();
        setSaveState('pending');
        saveTimerRef.current = window.setTimeout(() => {
            void saveNow();
        }, BUDDY_BID_AUTO_SAVE_MS);
    }, [clearSaveTimer, saveNow]);

    const assignOverlap = useCallback(
        (date: string, assignment: OverlapDayAssignment) => {
            setAssignments((current) => ({
                ...current,
                [date]: assignment,
            }));
            setDirtyDates((current) => {
                const next = new Set(current);
                next.add(date);
                return next;
            });
            setSaveError(null);
            scheduleSave();
        },
        [scheduleSave],
    );

    const applyRotationAssignments = useCallback(
        (nextAssignments: OverlapAssignmentsByDate) => {
            const changedDates = Object.keys(nextAssignments).filter((date) => {
                const next = nextAssignments[date];
                const prev = assignmentsRef.current[date];

                if (!next || !prev) {
                    return next !== prev;
                }

                return !assignmentsEqual(next, prev);
            });

            if (changedDates.length === 0) {
                return;
            }

            setAssignments(nextAssignments);
            setDirtyDates((current) => {
                const next = new Set(current);
                for (const date of changedDates) {
                    next.add(date);
                }
                return next;
            });
            setSaveError(null);
            scheduleSave();
        },
        [scheduleSave],
    );

    const resetAssignments = useCallback(async () => {
        clearSaveTimer();
        setSaveState('saving');
        setSaveError(null);

        try {
            const response = await fetch(
                `/app/bid-tools/buddy-bids/${planId}/assignments`,
                {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`Reset failed (${response.status})`);
            }

            const cleared = Object.fromEntries(
                Object.keys(assignmentsRef.current).map((date) => [
                    date,
                    pendingOverlapAssignment(),
                ]),
            );

            setAssignments(cleared);
            setDirtyDates(new Set());
            setSaveState('saved');
        } catch (error) {
            logClientError('buddy-bids.assignments.reset', error);
            setSaveError('Could not reset overlap assignments. Try again.');
            setSaveState('error');
        }
    }, [clearSaveTimer, planId]);

    useEffect(() => {
        if (dirtyDates.size === 0) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [dirtyDates.size]);

    useEffect(() => () => clearSaveTimer(), [clearSaveTimer]);

    const displayCalendar = applyLocalAssignments(calendar, assignments);
    const hasUnsavedChanges = dirtyDates.size > 0;

    return {
        displayCalendar,
        assignments,
        assignOverlap,
        applyRotationAssignments,
        resetAssignments,
        saveNow,
        hasUnsavedChanges,
        saveState,
        saveError,
        unsavedCount: dirtyDates.size,
    };
}
