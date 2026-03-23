import type { SVGAttributes } from 'react';

/** Airplane tail (vertical stabilizer) for My Sched branding */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            fill="currentColor"
        >
            {/* Airplane tail: vertical fin and horizontal stabilizers */}
            <path d="M20 6 L20 34 L24 34 L24 8 L32 14 L32 18 L24 12 L24 34 L28 34 L28 32 L36 20 L28 8 L28 6 L20 6 Z" />
            <path d="M12 20 L20 24 L20 26 L10 22 Z" />
            <path d="M28 24 L20 26 L20 24 L28 20 Z" />
        </svg>
    );
}
