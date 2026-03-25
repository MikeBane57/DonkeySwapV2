export type TutorialIntent =
    | 'get-started'
    | 'my-schedule'
    | 'available-shifts'
    | 'looking-for-work'
    | 'notifications'
    | 'settings'
    | 'admin';

export type WhatsNewItem = {
    id: string;
    title: string;
    description: string;
    /** Tour intent from server config (must match a key in `stepsForIntent`). */
    intent: string | null;
};

export type TutorialShared = {
    first_login_tutorial: boolean;
    seen_feature_ids: string[];
    whats_new: WhatsNewItem[];
};
