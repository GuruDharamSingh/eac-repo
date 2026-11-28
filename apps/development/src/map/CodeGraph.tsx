"use client";

import { useMemo, useState } from "react";

// The workspace dependency graph, drawn natively. Data: src/data/rails/workspace-graph.json,
// written by scripts/refresh-rails.mjs from scripts/workspace-graph/extract.mjs.
// An edge "A uses B" means A declares B as a dependency and/or imports it.

export interface WsNode {
  id: string;
  dir: string;
  kind: "app" | "package";
  description: string;
  files: number;
  lines: number;
  external: number;
  exportsSource: boolean;
}
export interface WsEdge {
  source: string;
  target: string;
  /** Which package.json field declares it, or null when it is imported without being declared. */
  field: string | null;
  /** How many files import it (0 = declared but never imported). */
  files: number;
}
export interface WsGraph {
  generated: string;
  nodes: WsNode[];
  edges: WsEdge[];
  cycles: string[][];
}

const W = 190;
const H = 22;
const GX = 120;
const GY = 8;

export function CodeGraph({ graph }: { graph: WsGraph }) {
  const [sel, setSel] = useState<string | null>(null);
  const { nodes, edges } = graph;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const m = useMemo(() => {
    const uses = new Map<string, WsEdge[]>();
    const usedBy = new Map<string, WsEdge[]>();
    for (const e of edges) {
      uses.set(e.source, [...(uses.get(e.source) ?? []), e]);
      usedBy.set(e.target, [...(usedBy.get(e.target) ?? []), e]);
    }
    // Column of a package = the longest chain of packages it sits on top of.
    const depth = new Map<string, number>();
    const walking = new Set<string>();
    const d = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (walking.has(id)) return 0;
      walking.add(id);
      const v = Math.max(-1, ...(uses.get(id) ?? []).filter((e) => byId.get(e.target)?.kind === "package").map((e) => d(e.target))) + 1;
      walking.delete(id);
      depth.set(id, v);
      return v;
    };
    nodes.filter((n) => n.kind === "package").forEach((n) => d(n.id));
    const maxD = Math.max(0, ...[...depth.values()]);
    const cols: WsNode[][] = Array.from({ length: maxD + 2 }, () => []);
    for (const n of nodes) cols[n.kind === "app" ? 0 : maxD - depth.get(n.id)! + 1].push(n);
    cols.forEach((c) => c.sort((a, b) => a.dir.localeCompare(b.dir)));
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((c, ci) => c.forEach((n, i) => pos.set(n.id, { x: 12 + ci * (W + GX), y: 28 + i * (H + GY) })));
    const height = 40 + Math.max(...cols.map((c) => c.length)) * (H + GY);
    return { uses, usedBy, pos, width: 24 + cols.length * (W + GX) - GX, height, cols };
  }, [nodes, edges, byId]);

  // What a change reaches: everything that imports it, and what imports those, and so on (real imports only).
  const reach = useMemo(() => {
    if (!sel) return new Set<string>();
    const out = new Set<string>();
    const todo = [sel];
    while (todo.length) {
      const id = todo.pop()!;
      for (const e of m.usedBy.get(id) ?? []) if (e.files > 0 && !out.has(e.source)) (out.add(e.source), todo.push(e.source));
    }
    out.delete(sel);
    return out;
  }, [sel, m]);

  const unused = edges.filter((e) => e.field && e.files === 0);
  const undeclared = edges.filter((e) => !e.field);
  const apps = nodes.filter((n) => n.kind === "app");
  const node = sel ? byId.get(sel) : null;
  const short = (id: string) => byId.get(id)?.dir.replace(/^(apps|packages)\//, "") ?? id;
  const reachApps = [...reach].filter((id) => byId.get(id)?.kind === "app");
  const reachPkgs = [...reach].filter((id) => byId.get(id)?.kind === "package");

  const edgeClass = (e: WsEdge) => {
    const touches = sel && (e.source === sel || e.target === sel);
    const inReach = sel && e.files > 0 && (reach.has(e.source) || e.source === sel) && (reach.has(e.target) || e.target === sel);
    return `dev-r-edge${touches ? " is-hot" : inReach ? " is-reach" : ""}${!e.field ? " is-undeclared" : e.files === 0 ? " is-unused" : ""}`;
  };

  return (
    <div>
      <div className="dev-r-summary">
        <div className="dev-r-stat">
          <b>{apps.length}</b>apps
        </div>
        <div className="dev-r-stat">
          <b>{nodes.length - apps.length}</b>packages
        </div>
        <div className="dev-r-stat">
          <b>{edges.length}</b>uses-lines
        </div>
        <div className="dev-r-stat">
          <b>{graph.cycles.length}</b>loops
        </div>
        <div className="dev-r-stat">
          <b>{unused.length}</b>listed but never used
        </div>
        <div className="dev-r-stat">
          <b>{undeclared.length}</b>used but not listed
        </div>
      </div>
      <p className="dev-r-muted" style={{ fontSize: 12, maxWidth: "80ch" }}>
        Apps are on the left, the packages they stand on to the right, the most basic packages furthest right. A line means "uses". Click a box to see what it uses, what uses it, and everything a change to it would reach (orange). Dashed orange lines are listed in package.json but never imported; red lines are imported without being listed. Whether an app is running is not shown here. Snapshot of {graph.generated.slice(0, 16).replace("T", " ")} UTC.
      </p>
      <div className="dev-r-two">
        <div className="dev-r-diagram">
          <svg width={m.width} height={m.height} role="img" aria-label="Apps and packages and what uses what">
            {m.cols.map((c, ci) => (
              <text key={ci} className="lane" x={12 + ci * (W + GX)} y={16}>
                {ci === 0 ? "Apps" : ci === 1 ? "Packages (top)" : ci === m.cols.length - 1 ? "Most basic" : ""}
              </text>
            ))}
            {edges.map((e, i) => {
              const a = m.pos.get(e.source);
              const b = m.pos.get(e.target);
              if (!a || !b) return null;
              const forward = b.x > a.x;
              const x1 = forward ? a.x + W : a.x;
              const x2 = forward ? b.x : b.x + W;
              const y1 = a.y + H / 2;
              const y2 = b.y + H / 2;
              const mx = (x1 + x2) / 2;
              return <path key={i} className={edgeClass(e)} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />;
            })}
            {nodes.map((n) => {
              const p = m.pos.get(n.id)!;
              const dim = sel && n.id !== sel && !reach.has(n.id) && !(m.uses.get(sel) ?? []).some((e) => e.target === n.id) && !(m.usedBy.get(sel) ?? []).some((e) => e.source === n.id);
              return (
                <g key={n.id} className={`dev-r-node${sel === n.id ? " is-sel" : ""}${dim ? " is-dim" : ""}`} transform={`translate(${p.x},${p.y})`} data-dev-anchor={`ws:${n.dir}`} onClick={() => setSel(sel === n.id ? null : n.id)}>
                  <title>{`${n.id}\n${n.description || n.dir}\n${n.files} files, ${n.lines} lines`}</title>
                  <rect className="box" width={W} height={H} rx={5} style={n.kind === "app" ? { stroke: "#4a5f9a" } : undefined} />
                  <text x={8} y={15}>
                    {short(n.id).slice(0, 30)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="dev-r-side" aria-live="polite">
          {node ? (
            <div data-dev-anchor={`ws:${node.dir}`}>
              <h3>{node.id}</h3>
              <p className="dev-r-muted" style={{ margin: 0 }}>
                <code>{node.dir}</code> · {node.kind === "app" ? "an app" : "a package"} · {node.files} files, {node.lines.toLocaleString("en-US")} lines
              </p>
              {node.description ? <p>{node.description}</p> : null}
              <h4>Uses ({(m.uses.get(node.id) ?? []).length})</h4>
              <ul>
                {(m.uses.get(node.id) ?? []).map((e) => (
                  <li key={e.target}>
                    <button onClick={() => setSel(e.target)}>{short(e.target)}</button>
                    <span className="dev-r-muted">{!e.field ? " (imported, not listed)" : e.files === 0 ? " (listed, never imported)" : ` (${e.files} file${e.files === 1 ? "" : "s"})`}</span>
                  </li>
                ))}
              </ul>
              <h4>Used by ({(m.usedBy.get(node.id) ?? []).length})</h4>
              <ul>
                {(m.usedBy.get(node.id) ?? []).map((e) => (
                  <li key={e.source}>
                    <button onClick={() => setSel(e.source)}>{short(e.source)}</button>
                    <span className="dev-r-muted">{!e.field ? " (not listed)" : e.files === 0 ? " (listed only)" : ""}</span>
                  </li>
                ))}
              </ul>
              <h4>A change here reaches</h4>
              <p style={{ margin: 0 }}>
                {reachApps.length} app{reachApps.length === 1 ? "" : "s"} and {reachPkgs.length} package{reachPkgs.length === 1 ? "" : "s"}
              </p>
              <ul>
                {reachApps.map((id) => (
                  <li key={id}>
                    <button onClick={() => setSel(id)}>{short(id)}</button> <span className="dev-r-muted">app</span>
                  </li>
                ))}
                {reachPkgs.map((id) => (
                  <li key={id}>
                    <button onClick={() => setSel(id)}>{short(id)}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <h3>Pick a box</h3>
              <p className="dev-r-muted">Click an app or package to see what it uses, what uses it, and how far a change to it reaches.</p>
            </div>
          )}
        </aside>
      </div>

      <h2>Loops</h2>
      {graph.cycles.length ? (
        <div className="dev-r-list">
          {graph.cycles.map((c, i) => (
            <div key={i}>
              {c.map((id) => short(id)).join(" → ")}
            </div>
          ))}
        </div>
      ) : (
        <p className="dev-r-muted">No loops: nothing depends on itself, however indirectly.</p>
      )}

      <h2>Listed but never used ({unused.length})</h2>
      <p className="dev-r-muted" style={{ fontSize: 12 }}>
        The package.json names these, but no file imports them. They can usually be removed.
      </p>
      <div className="dev-r-list">
        {unused.map((e, i) => (
          <div key={i} data-dev-anchor={`ws:${byId.get(e.source)?.dir ?? e.source}`}>
            <code>{short(e.source)}</code> lists <code>{short(e.target)}</code> ({e.field})
          </div>
        ))}
      </div>

      <h2>Used but not listed ({undeclared.length})</h2>
      <div className="dev-r-list">
        {undeclared.length ? (
          undeclared.map((e, i) => (
            <div key={i} data-dev-anchor={`ws:${byId.get(e.source)?.dir ?? e.source}`}>
              <code>{short(e.source)}</code> imports <code>{short(e.target)}</code> in {e.files} file{e.files === 1 ? "" : "s"} without listing it
            </div>
          ))
        ) : (
          <p className="dev-r-muted">None.</p>
        )}
      </div>
    </div>
  );
}
