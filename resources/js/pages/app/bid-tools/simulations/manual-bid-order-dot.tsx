export function ManualBidOrderDot({
    title = 'Manual bid order',
}: {
    title?: string;
}) {
    return (
        <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            title={title}
            aria-label={title}
        />
    );
}
