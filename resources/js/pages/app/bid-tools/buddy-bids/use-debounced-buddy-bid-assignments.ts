import { useCallback, useEffect, useRef, useState } from 'react';
import { logClientError } from '@/lib/client-logger';
import { getCsrfToken } from '@/lib/csrf';
import type { BuddyBidCalendarView } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import {
    applyLocalAssignments,
    assignmentsFromCalendar,
    BUDDY_BID_AUTO_SAVE_MS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';

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
    const calendarKeyRef = useRef(
        calendar.months.map((month) => month.key).join(','),
    );

    assignmentsRef.current = assignments;
    dirtyDatesRef.current = dirtyDates;

    useEffect(() => {
        const nextKey = calendar.months.map((month) => month.key).join(',');
        if (nextKey !== calendarKeyRef.current) {
            calendarKeyRef.current = nextKey;
            setAssignments(assignmentsFromCalendar(calendar));
            setDirtyDates(new Set());
            setSaveState('idle');
            setSaveError(null);
        }
    }, [calendar]);

    const clearSaveTimer = useCallback(() => {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const saveNow = useCallback(async () => {
        const datesToSave = Array.from(dirtyDatesRef.current);
        if (datesToSave.length === 0) {
            return;
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
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        assignments: datesToSave.map((date) => ({
                            date,
                            double_participant_id:
                                assignmentsRef.current[date] ?? null,
                        })),
                    }),
                },
            );

            if (!response.ok) {
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
        } catch (error) {
            logClientError('buddy-bids.assignments.save', error);
            setSaveError('Could not save overlap assignments. Try again.');
            setSaveState('error');
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
        (date: string, doubleParticipantId: number | null) => {
            setAssignments((current) => ({
                ...current,
                [date]: doubleParticipantId,
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
        (nextAssignments: Record<string, number | null>) => {
            const changedDates = Object.keys(nextAssignments).filter(
                (date) =>
                    nextAssignments[date] !== assignmentsRef.current[date],
            );

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
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`Reset failed (${response.status})`);
            }

            const cleared = Object.fromEntries(
                Object.keys(assignmentsRef.current).map((date) => [date, null]),
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
