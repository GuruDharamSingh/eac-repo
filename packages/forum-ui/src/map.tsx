import * as React from "react";
import type { Constellation, MapEdge, MapEdgeKind, MapNode } from "@elkdonis/services";
import { kindMeta } from "@elkdonis/cms-ui/surface";
import type { ForumHrefs } from "./connectors";
import { plural } from "./parts";

// ============================================================================
// The map. A constellation drawn as SVG on the server — no script, so it
// renders on every host and inside an embed, and every node is a real link.
//
// Layout is radial: the thread at the centre, its neighbours on one ring (two
// when there are many), placed in the order the read ranked them, so the
// strongest connections sit at the top and the eye goes there first. A
// person's map has no centre: all nodes on the ring, lines as chords.
//
// Every line is a kind the network already had. Drawn so the eye can tell a
// decision from a coincidence:
//
//   gathers · produced · talk · cites   solid steel, arrowed — somebody put it there
//   line                                dashed steel, count badge — people drew it
//   mentions                            dotted silver, arrowed — the prose says so
//   topic                               hairline — they share a tag
// ============================================================================

const EDGE_LABEL: Record<MapEdgeKind, [string, string]> = {
  gathers: ["gathers", "gathered by"],
  produced: ["produced", "produced at"],
  talk: ["discussed in", "discussion of"],
  cites: ["cites", "cited by"],
  mentions: ["mentions", "mentioned by"],
  topic: ["shares a tag with", "shares a tag with"],
  line: ["a line to", "a line to"],
};

/** A canvas sized to its population: three nodes don't need a wall. */
export function mapSize(graph: Constellation, max = 620): number {
  return Math.min(max, Math.max(300, 180 + graph.nodes.length * 48));
}

export function nodeHref(n: MapNode, hrefs: ForumHrefs): string | null {
  if (n.kind === "wiki_page") return hrefs.wikiPage?.(n.slug) ?? null;
  return hrefs.thread(n.id, n.slug);
}

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

interface Placed { node: MapNode; x: number; y: number; angle: number }

function place(graph: Constellation, size: number): { centre: Placed | null; ring: Placed[] } {
  const c = size / 2;
  const n = graph.nodes.length;
  const two = n > 10;
  const ring: Placed[] = graph.nodes.map((node, i) => {
    // Start at the top, go clockwise. With two rings, alternate so
    // neighbours in rank order don't crowd one radius.
    const angle = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2;
    const r = graph.centre ? (two ? (i % 2 === 0 ? size * 0.42 : size * 0.29) : size * 0.38) : size * 0.42;
    return { node, x: c + Math.cos(angle) * r, y: c + Math.sin(angle) * r, angle };
  });
  return { centre: graph.centre ? { node: graph.centre, x: c, y: c, angle: 0 } : null, ring };
}

function Node({ p, hrefs, isCentre, compact }: { p: Placed; hrefs: ForumHrefs; isCentre: boolean; compact: boolean }) {
  const r = isCentre ? 18 : compact ? 10 : 13;
  const meta = kindMeta(p.node.kind);
  const href = nodeHref(p.node, hrefs);
  const label = trunc(p.node.title, compact ? 16 : 26);
  // Label sits outside the node, away from the centre; anchored by which
  // side of the map the node is on so it never runs back across the ring.
  const cos = Math.cos(p.angle);
  const labelX = p.x + cos * (r + 6);
  const labelY = p.y + Math.sin(p.angle) * (r + 6) + 4;
  const anchor = isCentre ? "middle" : cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
  const body = (
    <g className={`gf-map-node${isCentre ? " is-centre" : ""}`} data-kind={p.node.kind}>
      {/* One string child: React hydrates an SVG <title> as a single text
          node, and several children render as several on the server. */}
      <title>{`${p.node.title} · ${meta.label || p.node.kind} · ${p.node.orgName}`}</title>
      <circle cx={p.x} cy={p.y} r={r} />
      <text className="gf-map-glyph" x={p.x} y={p.y + (isCentre ? 6 : 4)} textAnchor="middle" fontSize={isCentre ? 16 : compact ? 10 : 12}>{meta.glyph}</text>
      {!isCentre && (
        <text className="gf-map-label" x={labelX} y={isCentre ? p.y + r + 16 : labelY} textAnchor={anchor} fontSize={compact ? 10 : 11.5}>{label}</text>
      )}
      {isCentre && (
        <text className="gf-map-label is-centre" x={p.x} y={p.y + r + 16} textAnchor="middle" fontSize={12.5}>{trunc(p.node.title, 34)}</text>
      )}
    </g>
  );
  return href ? <a href={href}>{body}</a> : body;
}

function Edge({ e, from, to, idx, total, markerId }: { e: MapEdge; from: Placed; to: Placed; idx: number; total: number; markerId: string }) {
  // Several kinds between the same pair fan out a few pixels apart, so a
  // thread that is both gathered and mentioned shows two lines, not one.
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (idx - (total - 1) / 2) * 4;
  const nx = (-dy / len) * off, ny = (dx / len) * off;
  const directed = e.kind !== "topic" && e.kind !== "line";
  // Stop the arrow short of the node's rim.
  const shrink = directed ? 15 : 0;
  const x2 = to.x + nx - (dx / len) * shrink, y2 = to.y + ny - (dy / len) * shrink;
  const mx = (from.x + to.x) / 2 + nx, my = (from.y + to.y) / 2 + ny;
  return (
    <g className={`gf-map-edge gf-map-edge--${e.kind}${e.mine ? " is-mine" : ""}`}>
      <title>{e.kind === "topic" ? `share: ${e.label}` : e.kind === "line" ? `${plural(e.count, "person", "people")} drew a line` : EDGE_LABEL[e.kind][0]}</title>
      <line x1={from.x + nx} y1={from.y + ny} x2={x2} y2={y2} markerEnd={directed ? `url(#${markerId})` : undefined} />
      {e.kind === "line" && e.count > 1 && (
        <g className="gf-map-badge">
          <circle cx={mx} cy={my} r={8} />
          <text x={mx} y={my + 3.5} textAnchor="middle" fontSize={9}>{e.count}</text>
        </g>
      )}
    </g>
  );
}

export function ConstellationSvg({ graph, hrefs, size = 320, compact = false }: {
  graph: Constellation; hrefs: ForumHrefs; size?: number; compact?: boolean;
}) {
  const { centre, ring } = place(graph, size);
  const at = new Map<string, Placed>(ring.map((p) => [p.node.id, p]));
  if (centre) at.set(centre.node.id, centre);
  const markerId = `gf-arrow-${(centre?.node.id ?? "person").replace(/[^a-z0-9]/gi, "")}`;
  // Group edges by pair so parallel kinds fan out.
  const groups = new Map<string, MapEdge[]>();
  for (const e of graph.edges) {
    if (!at.has(e.from) || !at.has(e.to)) continue;
    const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const pad = compact ? 40 : 70;
  return (
    <svg className={`gf-map${compact ? " gf-map--compact" : ""}`} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} role="img" aria-label={centre ? `Map of ${centre.node.title}` : "Map"}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {[...groups.values()].map((list) =>
        list.map((e, i) => <Edge key={`${e.from}-${e.to}-${e.kind}-${i}`} e={e} from={at.get(e.from)!} to={at.get(e.to)!} idx={i} total={list.length} markerId={markerId} />)
      )}
      {ring.map((p) => <Node key={p.node.id} p={p} hrefs={hrefs} isCentre={false} compact={compact} />)}
      {centre && <Node p={centre} hrefs={hrefs} isCentre compact={compact} />}
    </svg>
  );
}

export function MapLegend({ graph }: { graph: Constellation }) {
  const kinds = new Set<string>(graph.edges.map((e) => (e.kind === "gathers" || e.kind === "produced" || e.kind === "talk" || e.kind === "cites" ? "gathers" : e.kind)));
  if (kinds.size === 0) return null;
  const rows: Array<[string, string, string]> = [
    ["gathers", "gathered", "somebody put it on the page"],
    ["line", "a line", "people drew it"],
    ["mentions", "mentioned", "the prose says so"],
    ["topic", "shared tag", "they were tagged alike"],
  ];
  return (
    <ul className="gf-map-legend">
      {rows.filter(([k]) => kinds.has(k)).map(([k, name, why]) => (
        <li key={k}><span className={`gf-map-swatch gf-map-swatch--${k}`} aria-hidden /> <b>{name}</b> <small>· {why}</small></li>
      ))}
    </ul>
  );
}

/** The map as a list, for reading and for anyone the picture is not for. */
export function MapEdgeList({ graph, hrefs, showOrg }: { graph: Constellation; hrefs: ForumHrefs; showOrg: boolean }) {
  if (graph.edges.length === 0) return null;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  if (graph.centre) byId.set(graph.centre.id, graph.centre);
  const centreId = graph.centre?.id ?? null;
  return (
    <ul className="gf-map-list">
      {graph.edges.map((e, i) => {
        const outward = centreId ? e.from === centreId : true;
        const otherId = centreId ? (outward ? e.to : e.from) : e.to;
        const other = byId.get(otherId);
        const first = centreId ? null : byId.get(e.from);
        if (!other) return null;
        const verb = e.kind === "topic" ? `shares “${e.label}” with` : e.kind === "line" ? (e.count > 1 ? `${e.count} people drew a line to` : e.mine ? "you drew a line to" : `${e.names[0] ?? "someone"} drew a line to`) : EDGE_LABEL[e.kind][outward ? 0 : 1];
        const href = nodeHref(other, hrefs);
        return (
          <li key={`${e.from}-${e.to}-${e.kind}-${i}`} className={`gf-map-row gf-map-row--${e.kind}`}>
            <span className={`gf-map-swatch gf-map-swatch--${e.kind === "mentions" || e.kind === "topic" || e.kind === "line" ? e.kind : "gathers"}`} aria-hidden />
            {first && <><a href={nodeHref(first, hrefs) ?? "#"}>{first.title}</a> — </>}
            <span className="gf-map-verb">{verb}</span>{" "}
            {href ? <a href={href}>{other.title}</a> : other.title}
            {showOrg && <span className="gf-map-org"> · {other.orgName}</span>}
            {e.kind === "line" && e.names.length > 0 && e.count > 1 && <span className="gf-map-names"> ({e.names.join(", ")}{e.count > e.names.length ? "…" : ""})</span>}
            {e.kind === "line" && e.label && <span className="gf-map-note"> — {e.label}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Draw a line from here to another topic. Paste the topic's link or id —
 * the one field that works with no script and from any host.
 */
export function DrawLineForm({ actionBase, threadId, back, compact }: { actionBase: string; threadId: string; back: string; compact?: boolean }) {
  return (
    <form method="post" action={`${actionBase.replace(/\/$/, "")}/line`} className={`gf-line-form${compact ? " gf-line-form--compact" : ""}`}>
      <input type="hidden" name="thread" value={threadId} />
      <input type="hidden" name="back" value={back} />
      <input name="to" className="gf-input gf-input--sm" required placeholder="Paste a topic's link" aria-label="The other topic's link or id" />
      {!compact && <input name="note" className="gf-input gf-input--sm" maxLength={200} placeholder="Why (optional, shows on your map)" aria-label="Why" />}
      <button type="submit" className="gf-tool">Draw a line</button>
    </form>
  );
}

export function EraseLineForm({ actionBase, threadId, otherId, back }: { actionBase: string; threadId: string; otherId: string; back: string }) {
  return (
    <form method="post" action={`${actionBase.replace(/\/$/, "")}/line`} className="gf-line-erase">
      <input type="hidden" name="thread" value={threadId} />
      <input type="hidden" name="to" value={otherId} />
      <input type="hidden" name="do" value="erase" />
      <input type="hidden" name="back" value={back} />
      <button type="submit" className="gf-tool" title="Erase your line">× erase</button>
    </form>
  );
}
