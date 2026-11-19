export type OverlapAssignmentMode = 'pending' | 'double' | 'singles';

export type OverlapDayAssignment = {
    overlap_mode: OverlapAssignmentMode;
    double_participant_id: number | null;
};

export function pendingOverlapAssignment(): OverlapDayAssignment {
    return {
        overlap_mode: 'pending',
        double_participant_id: null,
    };
}

export function doubleOverlapAssignment(
    participantId: number,
): OverlapDayAssignment {
    return {
        overlap_mode: 'double',
        double_participant_id: participantId,
    };
}

export function singlesOverlapAssignment(): OverlapDayAssignment {
    return {
        overlap_mode: 'singles',
        double_participant_id: null,
    };
}

export function overlapAssignmentFromApi(
    overlapMode: string | null | undefined,
    doubleParticipantId: number | null | undefined,
): OverlapDayAssignment {
    if (overlapMode === 'singles') {
        return singlesOverlapAssignment();
    }

    if (overlapMode === 'double' && doubleParticipantId != null) {
        return doubleOverlapAssignment(doubleParticipantId);
    }

    if (doubleParticipantId != null) {
        return doubleOverlapAssignment(doubleParticipantId);
    }

    return pendingOverlapAssignment();
}

export function overlapAssignmentToApi(assignment: OverlapDayAssignment): {
    overlap_mode: 'double' | 'singles' | null;
    double_participant_id: number | null;
} {
    if (assignment.overlap_mode === 'double') {
        return {
            overlap_mode: 'double',
            double_participant_id: assignment.double_participant_id,
        };
    }

    if (assignment.overlap_mode === 'singles') {
        return {
            overlap_mode: 'singles',
            double_participant_id: null,
        };
    }

    return {
        overlap_mode: null,
        double_participant_id: null,
    };
}

/** @deprecated Use Record<string, OverlapDayAssignment> */
export function legacyDoubleIdFromAssignment(
    assignment: OverlapDayAssignment,
): number | null {
    return assignment.overlap_mode === 'double'
        ? assignment.double_participant_id
        : null;
}

export function assignmentsEqual(
    a: OverlapDayAssignment,
    b: OverlapDayAssignment,
): boolean {
    return (
        a.overlap_mode === b.overlap_mode &&
        a.double_participant_id === b.double_participant_id
    );
}

/**
 * Click a participant's overlap cell.
 * - Pending → double for clicked buddy (D).
 * - Double on clicked buddy → open (O); the next click on that same buddy → singles (S).
 * - Double on the other buddy → switch double in one click.
 * - Shift/Alt/Ctrl+click → singles (S) from any state.
 */
export function nextOverlapAssignmentOnClick(
    current: OverlapDayAssignment,
    clickedParticipantId: number,
    modifierKey: boolean,
    clearedDoubleParticipantId: number | null = null,
): OverlapDayAssignment {
    if (modifierKey) {
        return singlesOverlapAssignment();
    }

    if (current.overlap_mode === 'singles') {
        return doubleOverlapAssignment(clickedParticipantId);
    }

    if (current.overlap_mode === 'double') {
        if (current.double_participant_id === clickedParticipantId) {
            return pendingOverlapAssignment();
        }

        return doubleOverlapAssignment(clickedParticipantId);
    }

    if (
        clearedDoubleParticipantId !== null &&
        clearedDoubleParticipantId === clickedParticipantId
    ) {
        return singlesOverlapAssignment();
    }

    return doubleOverlapAssignment(clickedParticipantId);
}
