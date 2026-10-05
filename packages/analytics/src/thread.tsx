/**
 * Marks the current page as a post so the beacon can attribute the view to a
 * thread. Render once on a thread page (server or client component):
 *
 *   <AnalyticsThread id={thread.id} />
 *
 * The collector looks the id up itself and drops the path of any thread that
 * is not public, so the marker carries no visibility claim.
 */
export function AnalyticsThread({ id }: { id: string }) {
  return <span hidden data-eac-thread={id} />;
}
