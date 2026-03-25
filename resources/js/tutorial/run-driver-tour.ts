import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * Run a Driver.js tour. Skips steps whose element selector is missing from the DOM.
 * @returns cleanup to destroy an in-progress tour
 */
export function runDriverTour(
    rawSteps: DriveStep[],
    onComplete: () => void,
): () => void {
    const steps = rawSteps.filter((step) => {
        const el = step.element;
        if (el === undefined || el === null) {
            return true;
        }
        if (typeof el === 'string') {
            return document.querySelector(el) !== null;
        }
        if (typeof el === 'function') {
            try {
                return el() !== undefined;
            } catch {
                return false;
            }
        }
        return true;
    });

    if (steps.length === 0) {
        onComplete();
        return () => {};
    }

    let manuallyDestroyed = false;

    const d = driver({
        showProgress: true,
        smoothScroll: true,
        steps,
        onDestroyed: () => {
            if (!manuallyDestroyed) {
                onComplete();
            }
        },
    });

    d.drive();

    return () => {
        manuallyDestroyed = true;
        if (d.isActive()) {
            d.destroy();
        }
    };
}
