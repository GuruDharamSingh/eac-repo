import { redirect } from "next/navigation";
import { DrawingEditor } from "@/components/DrawingEditor";
import { drawingSeed, drawingTargets } from "@/lib/drawing";
import { getViewer } from "@/lib/viewer";
import { hrefs } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * A new drawing. `?from=<threadId>` seeds it with that thread's map and
 * posts it, by default, into the same category — the drawing then cites the
 * thread, so it shows on the thread's own constellation.
 */
export default async function NewDrawingPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ from }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer.userId) redirect(`/login?next=${encodeURIComponent(`/draw/new${from ? `?from=${from}` : ""}`)}`);

  const [targets, seed] = await Promise.all([
    drawingTargets(viewer),
    from ? drawingSeed(from, viewer) : Promise.resolve(null),
  ]);
  const defaultTarget = seed?.section ? `${seed.orgId}|${seed.section}` : null;
  const centre = seed?.nodes.find((n) => n.centre);

  return (
    <div className="gf-draw-page">
      <header className="gf-pagehead">
        <div className="gf-pagehead-main">
          <h1 className="gf-pagetitle">{centre ? <>Drawing over <span className="gf-map-title-of">the map of</span> {centre.title}</> : "New drawing"}</h1>
          <p className="gf-pagesub">{centre ? "The map is laid out as a start — move it, restyle it, draw around it." : "A picture as a post. It shows wherever a post shows."}</p>
        </div>
      </header>
      {targets.length === 0 ? (
        <p className="gf-empty">There is nowhere you can post yet.</p>
      ) : (
        <DrawingEditor
          mode="new"
          initialTitle={centre ? `Map of ${centre.title}` : ""}
          initialCaption=""
          seed={seed ? { nodes: seed.nodes, edges: seed.edges } : null}
          targets={targets}
          defaultTarget={defaultTarget && targets.some((t) => t.value === defaultTarget) ? defaultTarget : null}
          from={from ?? null}
          cancelHref={centre ? `${hrefs.thread(centre.id, "topic")}/map` : hrefs.root()}
        />
      )}
    </div>
  );
}
