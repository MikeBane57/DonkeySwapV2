import { Link } from '@inertiajs/react';

export default function Landing() {
    return (
        <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-white">
            <img
                src="/images/donkey-swap-logo.png"
                alt="DonkeySwap"
                className="h-auto w-full max-w-[280px] object-contain px-6 sm:max-w-[320px]"
            />
            <Link
                href="/login"
                className="absolute top-6 right-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
                Sign in
            </Link>
        </div>
    );
}
