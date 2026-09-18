import { getConstellation, listBoards, type ForumBoard } from "@elkdonis/services";
import type { SeedEdge, SeedNode } from "@/components/DrawingEditor";
import type { HostViewer } from "@/lib/viewer";
import { hrefs, FORUM_URL } from "@/lib/site";

const RANK: Record<string, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };

/** Every category this viewer may post a drawing into, as `orgId|feed` options. */
export async function drawingTargets(viewer: HostViewer): Promise<Array<{ value: string; label: string }>> {
  if (!viewer.userId) return [];
  const boards: ForumBoard[] = await listBoards({ kind: "network" }, viewer);
  const out: Array<{ value: string; label: string }> = [];
  for (const b of boards) {
    for (const f of b.feeds) {
      const ok = !f.minRole || viewer.isGlobalAdmin || (RANK[viewer.roles[b.orgId] ?? ""] ?? 0) >= (RANK[f.minRole] ?? 0);
      if (ok) out.push({ value: `${b.orgId}|${f.slug}`, label: `${b.name} · ${f.name}` });
    }
  }
  return out;
}

/**
 * A thread's map as a seed for the editor: the same nodes and edges the SVG
 * draws, with absolute links so a node still opens its thread from the
 * exported picture wherever that is shown.
 */
export async function drawingSeed(threadId: string, viewer: HostViewer): Promise<{ nodes: SeedNode[]; edges: SeedEdge[]; orgId: string; section: string | null } | null> {
  const graph = await getConstellation(threadId, { viewer, limit: 24 });
  if (!graph || !graph.centre) return null;
  const abs = (path: string | null) => (path ? `${FORUM_URL}${path}` : null);
  const href = (n: { id: string; slug: string; kind: string }) => abs(n.kind === "wiki_page" ? hrefs.wikiPage?.(n.slug) ?? null : hrefs.thread(n.id, n.slug));
  return {
    nodes: [
      { id: graph.centre.id, title: graph.centre.title, kind: graph.centre.kind, href: href(graph.centre), centre: true },
      ...graph.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind, href: href(n) })),
    ],
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
    orgId: graph.centre.orgId,
    section: graph.centre.section,
  };
}
