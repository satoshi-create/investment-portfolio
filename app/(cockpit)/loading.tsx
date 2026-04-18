/**
 * In-route loading: borderless pulse blocks only — outer padding comes from `CockpitShell`
 * so the rounded “frame flash” does not appear ahead of content.
 */
export default function CockpitSegmentLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-32 rounded-2xl bg-muted/15 animate-pulse" />
      <div className="h-48 rounded-2xl bg-muted/15 animate-pulse" />
    </div>
  );
}
