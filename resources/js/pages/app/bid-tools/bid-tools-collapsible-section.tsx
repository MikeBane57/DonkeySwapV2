import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function BidToolsCollapsibleSection({
    title,
    summary,
    defaultOpen = true,
    open,
    onOpenChange,
    children,
    className = '',
}: {
    title: string;
    summary?: string;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
    className?: string;
}) {
    return (
        <Collapsible
            defaultOpen={defaultOpen}
            open={open}
            onOpenChange={onOpenChange}
            className={`rounded-lg border border-sidebar-border/70 ${className}`}
        >
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                    <div className="min-w-0">
                        <span className="text-sm font-medium">{title}</span>
                        {summary && (
                            <span className="ml-2 text-xs text-muted-foreground">
                                {summary}
                            </span>
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 border-t border-sidebar-border/50 px-3 py-3">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}
