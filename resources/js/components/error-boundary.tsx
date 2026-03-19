import { Component   } from 'react';
import type {ErrorInfo, ReactNode} from 'react';

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};

type State = {
    hasError: boolean;
    error: Error | null;
};

/**
 * Catches render errors in the tree and shows a fallback instead of a white screen.
 * Use to prevent uncaught exceptions from crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
                    <p className="font-medium text-destructive">Something went wrong</p>
                    <p className="text-sm text-muted-foreground">
                        {this.state.error.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        type="button"
                        className="text-sm text-primary underline hover:no-underline"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
