import type { DriveStep } from 'driver.js';
import type { TutorialIntent } from '@/types/tutorial';

/** Stable selectors: add matching `data-tour` on DOM nodes in layouts/pages. */
export function stepsForIntent(intent: TutorialIntent): DriveStep[] {
    switch (intent) {
        case 'get-started':
            return [
                {
                    popover: {
                        title: 'Welcome',
                        description:
                            'This short tour shows where to manage your schedule, find open shifts, and get help anytime from the user menu.',
                    },
                },
                {
                    element: '[data-tour="sidebar-nav"]',
                    popover: {
                        title: 'Sidebar',
                        description:
                            'Use the sidebar to switch between My Schedule, Available shifts, and Looking for work.',
                    },
                },
                {
                    element: '[data-tour="nav-my-schedule"]',
                    popover: {
                        title: 'My Schedule',
                        description:
                            'Your calendar and shift tools live here—post swaps, add shifts, and request time off.',
                    },
                },
                {
                    element: '[data-tour="nav-available"]',
                    popover: {
                        title: 'Available shifts',
                        description:
                            'Browse shifts others have posted. You only see posts you are qualified to pick up.',
                    },
                },
                {
                    element: '[data-tour="nav-looking-for-work"]',
                    popover: {
                        title: 'Looking for work',
                        description:
                            'Post when you want to pick up a shift so others can offer you theirs.',
                    },
                },
                {
                    element: '[data-tour="dashboard-left-tabs"]',
                    popover: {
                        title: 'Time off, availability, and posts',
                        description:
                            'On My Schedule, use these tabs: Time off for dates you need off, Available to work for days you can fly extra, and My active posts for what you have open.',
                    },
                },
                {
                    element: '[data-tour="notifications-bell"]',
                    popover: {
                        title: 'Notifications',
                        description:
                            'Unread updates appear here. Open the full list from the bell or the Notifications page.',
                    },
                },
                {
                    element: '[data-tour="user-menu"]',
                    popover: {
                        title: 'Help anytime',
                        description:
                            'Open your profile menu and choose Run tutorial to replay any guide.',
                    },
                },
            ];
        case 'my-schedule':
            return [
                {
                    popover: {
                        title: 'My Schedule',
                        description:
                            'This page is your home base: upcoming shifts, time off, posts, and your calendar.',
                    },
                },
                {
                    element: '[data-tour="dashboard-shift-summary"]',
                    popover: {
                        title: 'Shift summary',
                        description:
                            'See your current or next shift and quick actions at a glance.',
                    },
                },
                {
                    element: '[data-tour="dashboard-calendar"]',
                    popover: {
                        title: 'Calendar',
                        description:
                            'Click days to add shifts, post for swap, or request time off. Use the toolbar to refresh or import.',
                    },
                },
                {
                    element: '[data-tour="dashboard-left-tabs"]',
                    popover: {
                        title: 'Dates off, availability, and posts',
                        description:
                            'These three tabs work together: Time off (dates you need off), Available to work (days you can pick up extra), and My active posts (your open swap and looking-for-work postings).',
                    },
                },
                {
                    element: '[data-tour="dashboard-tab-dates-off"]',
                    popover: {
                        title: 'Dates I need off',
                        description:
                            'Under Time off, add ranges when you cannot work. Select a range to see shifts in that window and post them for trade, giveaway, or flight following.',
                    },
                },
                {
                    element: '[data-tour="dashboard-tab-available-to-work"]',
                    popover: {
                        title: 'Available to work',
                        description:
                            'Here you set date ranges when you are willing to pick up extra work. That drives your availability for those days.',
                    },
                },
                {
                    element: '[data-tour="dashboard-tab-active-posts"]',
                    popover: {
                        title: 'My active posts',
                        description:
                            'See every posting you still have open—trades, giveaways, flight following, and looking-for-work—until each shift starts.',
                    },
                },
            ];
        case 'available-shifts':
            return [
                {
                    popover: {
                        title: 'Available shifts',
                        description:
                            'Open posts from other crew. Refresh often—the list updates automatically.',
                    },
                },
                {
                    element: '[data-tour="available-main"]',
                    popover: {
                        title: 'Browse and offer',
                        description:
                            'Review eligibility hints, then open a post to submit an offer when you want the shift.',
                    },
                },
            ];
        case 'looking-for-work':
            return [
                {
                    popover: {
                        title: 'Looking for work',
                        description:
                            'Create a post for dates you want to fly. Others with a shift that day can offer it to you.',
                    },
                },
                {
                    element: '[data-tour="lfw-header-actions"]',
                    popover: {
                        title: 'Create a post',
                        description:
                            'Use Create post to add dates you are looking to pick up, then manage offers from others.',
                    },
                },
                {
                    element: '[data-tour="lfw-main"]',
                    popover: {
                        title: 'Your posts',
                        description:
                            'Track status, filters, and responses from here.',
                    },
                },
            ];
        case 'notifications':
            return [
                {
                    popover: {
                        title: 'Notifications',
                        description:
                            'All unread messages land here until you open or dismiss them.',
                    },
                },
                {
                    element: '[data-tour="notifications-main"]',
                    popover: {
                        title: 'Read and dismiss',
                        description:
                            'Tap a row for details, or mark all as read when you are caught up.',
                    },
                },
            ];
        case 'settings':
            return [
                {
                    popover: {
                        title: 'Settings',
                        description:
                            'Update profile, password, appearance, preferences, qualifications, and schedule import.',
                    },
                },
                {
                    element: '[data-tour="settings-nav"]',
                    popover: {
                        title: 'Settings sections',
                        description:
                            'Jump between sections from this list. Profile and Preferences are the most common starting points.',
                    },
                },
            ];
        case 'admin':
            return [
                {
                    popover: {
                        title: 'Admin',
                        description:
                            'Administrators manage users, workgroups, shifts, imports, and messaging from this area.',
                    },
                },
                {
                    element: '[data-tour="nav-admin"]',
                    popover: {
                        title: 'Admin Panel',
                        description:
                            'Open the admin hub from here. Individual tools are grouped by task (users, shifts, imports, etc.).',
                    },
                },
            ];
        default:
            return [];
    }
}

export function pathForIntent(intent: TutorialIntent): string {
    switch (intent) {
        case 'get-started':
        case 'my-schedule':
            return '/app';
        case 'available-shifts':
            return '/app/available';
        case 'looking-for-work':
            return '/app/looking-for-work';
        case 'notifications':
            return '/app/notifications';
        case 'settings':
            return '/app/settings/profile';
        case 'admin':
            return '/app/admin';
        default:
            return '/app';
    }
}
