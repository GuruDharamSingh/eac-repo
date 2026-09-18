import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { GATHER_ANONYMOUS, visibleToGatherer, type GatherRelation, type GatherViewer } from './gather';

// ============================================================================
// The constellation: everything one thread is connected to, as a graph.
//
// The network already holds four kinds of connection and none of them knew
// about the others:
//
//   gathers/produced/talk/cites  thread_gathers    deliberate, the page's own
//   mentions                     thread_references derived from the prose
//   topic                        thread_topics     two threads share a tag
//   line                         thread_lines      a PERSON drew one (137)
//
// This reads all four for one thread — or all of one person's lines — and
// returns nodes and edges. The forum draws it as a map; it decides nothing
// about how. Visibility is the gatherer's predicate: a node the viewer may
// not see is dropped, and every edge to it goes with it, so a private thread
// never shows up as an unnamed dot.
// ============================================================================

export type MapEdgeKind = GatherRelation | 'mentions' | 'topic' | 'line';

export interface MapNode {
  id: string;
  slug: string;
  title: string;
  kind: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  section: string | null;
}

export interface MapEdge {
  from: string;
  to: string;
  kind: MapEdgeKind;
  /** The tag's name for `topic`; the note for a `line` on a person's map. */
  label: string | null;
  /** `line` only: how many people drew it, and whether the viewer is one. */
  count: number;
  mine: boolean;
  /** `line` only: a few of their names. */
  names: string[];
}

export interface Constellation {
  /** The thread the map is about; null for a person's map. */
  centre: MapNode | null;
  nodes: MapNode[];
  edges: MapEdge[];
  /** Nodes cut for room: the map shows the strongest, the list says how many more. */
  omitted: number;
}

interface NodeRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  org_id: string;
  org_slug: string;
  org_name: string;
  section: string | null;
}

function toNode(r: NodeRow): MapNode {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    orgId: r.org_id,
    orgSlug: r.org_slug,
    orgName: r.org_name,
    section: r.section,
  };
}

async function loadNodes(ids: string[], viewer: GatherViewer): Promise<Map<string, MapNode>> {
  if (ids.length === 0) return new Map();
  const rows = await db<NodeRow[]>`
    SELECT t.id, t.slug, t.title, t.kind, t.org_id, o.slug AS org_slug, o.name AS org_name, t.section
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ANY(${ids}) AND ${visibleToGatherer(viewer)}
  `;
  return new Map(rows.map((r) => [r.id, toNode(r)]));
}

const WEIGHT: Record<MapEdgeKind, number> = {
  gathers: 4, produced: 4, talk: 4, cites: 4,
  line: 3,
  mentions: 2,
  topic: 1,
};

/**
 * Everything one thread is connected to.
 *
 * `limit` caps the NODES, keeping the strongest connections: a deliberate
 * gather outranks a line, a line outranks a mention, a mention outranks a
 * shared tag. The number cut is reported so the page can say so.
 */
export async function getConstellation(
  threadId: string,
  options: { viewer?: GatherViewer; limit?: number } = {}
): Promise<Constellation | null> {
  const viewer = options.viewer ?? GATHER_ANONYMOUS;
  const limit = Math.max(4, Math.min(options.limit ?? 40, 120));
  const uid = viewer.userId;

  const centreMap = await loadNodes([threadId], viewer);
  const centre = centreMap.get(threadId);
  if (!centre) return null;

  const [deliberate, mentions, topics, lines] = await Promise.all([
    db<Array<{ other: string; relation: GatherRelation; dir: 'out' | 'in' }>>`
      SELECT g.target_thread_id AS other, g.relation, 'out' AS dir
      FROM thread_gathers g
      WHERE g.thread_id = ${threadId} AND g.target_thread_id IS NOT NULL
      UNION ALL
      SELECT g.thread_id AS other, g.relation, 'in' AS dir
      FROM thread_gathers g
      WHERE g.target_thread_id = ${threadId}
    `,
    db<Array<{ other: string; dir: 'out' | 'in' }>>`
      SELECT r.references_thread_id AS other, 'out' AS dir
      FROM thread_references r WHERE r.thread_id = ${threadId}
      UNION ALL
      SELECT r.thread_id AS other, 'in' AS dir
      FROM thread_references r WHERE r.references_thread_id = ${threadId}
    `,
    db<Array<{ other: string; name: string }>>`
      SELECT t2.thread_id AS other, tp.name
      FROM thread_topics t1
      JOIN thread_topics t2 ON t2.topic_id = t1.topic_id AND t2.thread_id <> t1.thread_id
      JOIN topics tp ON tp.id = t1.topic_id
      WHERE t1.thread_id = ${threadId}
      LIMIT 120
    `,
    db<Array<{ other: string; n: string; mine: boolean; names: string[] }>>`
      SELECT CASE WHEN l.a_thread_id = ${threadId} THEN l.b_thread_id ELSE l.a_thread_id END AS other,
             COUNT(DISTINCT l.user_id)::text AS n,
             BOOL_OR(l.user_id = ${uid}::uuid) AS mine,
             (ARRAY_AGG(DISTINCT COALESCE(u.display_name, 'someone')))[1:4] AS names
      FROM thread_lines l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.a_thread_id = ${threadId} OR l.b_thread_id = ${threadId}
      GROUP BY 1
    `,
  ]);

  // Every edge, before visibility and before the cap.
  const raw: MapEdge[] = [];
  for (const d of deliberate) {
    raw.push({
      from: d.dir === 'out' ? threadId : d.other,
      to: d.dir === 'out' ? d.other : threadId,
      kind: d.relation, label: null, count: 1, mine: false, names: [],
    });
  }
  for (const m of mentions) {
    raw.push({
      from: m.dir === 'out' ? threadId : m.other,
      to: m.dir === 'out' ? m.other : threadId,
      kind: 'mentions', label: null, count: 1, mine: false, names: [],
    });
  }
  // One topic edge per neighbour, the tags joined, so a pair sharing three
  // tags is one hairline rather than three.
  const byTopic = new Map<string, string[]>();
  for (const t of topics) (byTopic.get(t.other) ?? byTopic.set(t.other, []).get(t.other)!).push(t.name);
  for (const [other, names] of byTopic) {
    raw.push({ from: threadId, to: other, kind: 'topic', label: [...new Set(names)].join(', '), count: 1, mine: false, names: [] });
  }
  for (const l of lines) {
    raw.push({ from: threadId, to: l.other, kind: 'line', label: null, count: Number(l.n), mine: Boolean(l.mine), names: l.names ?? [] });
  }

  // Rank neighbours, load the ones the viewer may see, cap.
  const score = new Map<string, number>();
  for (const e of raw) {
    const other = e.from === threadId ? e.to : e.from;
    score.set(other, (score.get(other) ?? 0) + WEIGHT[e.kind] * (e.kind === 'line' ? Math.min(e.count, 5) : 1));
  }
  const nodes = await loadNodes([...score.keys()], viewer);
  const ranked = [...nodes.keys()].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
  const kept = new Set(ranked.slice(0, limit));

  return {
    centre,
    nodes: ranked.filter((id) => kept.has(id)).map((id) => nodes.get(id)!),
    edges: raw.filter((e) => kept.has(e.from === threadId ? e.to : e.from)),
    omitted: ranked.length - kept.size,
  };
}

/**
 * A person's map: every line they drew, as one graph with no centre.
 *
 * Their space, so it shows to anyone who may see the threads involved —
 * a line to something the viewer may not see is dropped with its node.
 */
export async function getPersonMap(
  userId: string,
  options: { viewer?: GatherViewer; limit?: number } = {}
): Promise<Constellation> {
  const viewer = options.viewer ?? GATHER_ANONYMOUS;
  const limit = Math.max(4, Math.min(options.limit ?? 60, 200));
  const rows = await db<Array<{ a: string; b: string; note: string | null }>>`
    SELECT a_thread_id AS a, b_thread_id AS b, note
    FROM thread_lines
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 400
  `;
  const ids = [...new Set(rows.flatMap((r) => [r.a, r.b]))];
  const nodes = await loadNodes(ids, viewer);
  // Most-connected first, so a cap keeps the person's hubs.
  const degree = new Map<string, number>();
  for (const r of rows) {
    if (!nodes.has(r.a) || !nodes.has(r.b)) continue;
    degree.set(r.a, (degree.get(r.a) ?? 0) + 1);
    degree.set(r.b, (degree.get(r.b) ?? 0) + 1);
  }
  const ranked = [...degree.keys()].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
  const kept = new Set(ranked.slice(0, limit));
  const mine = viewer.userId === userId;
  return {
    centre: null,
    nodes: ranked.filter((id) => kept.has(id)).map((id) => nodes.get(id)!),
    edges: rows
      .filter((r) => kept.has(r.a) && kept.has(r.b))
      .map((r) => ({ from: r.a, to: r.b, kind: 'line' as const, label: r.note, count: 1, mine, names: [] })),
    omitted: ranked.length - kept.size,
  };
}

/** The line's canonical order: the pair is undirected and stored a < b. */
function pair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export class LineError extends Error {}

/**
 * Draw a line between two threads, as this person.
 *
 * Both ends must be visible to the drawer — a line is the one act that can
 * name a thread from another org, so it may only name what they can see.
 * Idempotent: drawing a line already drawn returns it.
 */
export async function drawLine(
  userId: string,
  x: string,
  y: string,
  options: { note?: string | null; viewer?: GatherViewer } = {}
): Promise<{ id: string; created: boolean }> {
  if (x === y) throw new LineError('A thread cannot be linked to itself.');
  const [a, b] = pair(x, y);
  const viewer = options.viewer ?? { userId, roles: {} };
  const seen = await loadNodes([a, b], viewer);
  if (seen.size < 2) throw new LineError('No such topic.');
  const id = nanoid();
  const note = options.note?.trim() || null;
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO thread_lines (id, user_id, a_thread_id, b_thread_id, note)
    VALUES (${id}, ${userId}, ${a}, ${b}, ${note})
    ON CONFLICT (user_id, a_thread_id, b_thread_id) DO NOTHING
    RETURNING id
  `;
  if (row) return { id: row.id, created: true };
  const [existing] = await db<Array<{ id: string }>>`
    SELECT id FROM thread_lines WHERE user_id = ${userId} AND a_thread_id = ${a} AND b_thread_id = ${b}
  `;
  if (!existing) throw new LineError('Could not draw the line.');
  return { id: existing.id, created: false };
}

/** Erase one's own line. Nobody else's — the line is theirs. */
export async function eraseLine(userId: string, x: string, y: string): Promise<boolean> {
  const [a, b] = pair(x, y);
  const rows = await db`
    DELETE FROM thread_lines
    WHERE user_id = ${userId} AND a_thread_id = ${a} AND b_thread_id = ${b}
    RETURNING id
  `;
  return rows.length > 0;
}
