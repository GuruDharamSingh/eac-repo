"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LEVELS, levelOf } from "./types";

// The modules (tracks) as a map: who leads to whom, and which gate each one needs.
// Drawn as plain SVG. Each lane is an area; columns run left to right in the order people meet them.

export interface NexusTrack {
  id: string;
  label: string;
  area: string;
  levels: number[];
  leads_to: string[];
  gates: string[];
  courses: Array<{ id: string; label: string }>;
  steps: Array<{ label: string; level: number }>;
}

const W = 170;
const H = 44;
const GX = 70;
const GY = 14;
const LEFT = 110;
const LANE_PAD = 12;

export function NexusGraph({ tracks, areas }: { tracks: NexusTrack[]; areas: string[] }) {
  const [sel, setSel] = useState<string | null>(null);

  const layout = useMemo(() => {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    // Column = the longest chain of leads_to that arrives here (cycles are cut).
    const depth = new Map<string, number>();
    const walking = new Set<string>();
    const incoming = new Map<string, string[]>();
    for (const t of tracks) for (const to of t.leads_to) if (byId.has(to)) incoming.set(to, [...(incoming.get(to) ?? []), t.id]);
    const d = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (walking.has(id)) return 0;
      walking.add(id);
      const v = Math.max(-1, ...(incoming.get(id) ?? []).map(d)) + 1;
      walking.delete(id);
      depth.set(id, v);
      return v;
    };
    tracks.forEach((t) => d(t.id));
    const cols = Math.max(0, ...[...depth.values()]) + 1;
    const pos = new Map<string, { x: number; y: number }>();
    const laneBox: Array<{ area: string; y: number; h: number }> = [];
    let y = 8;
    for (const area of areas) {
      const inArea = tracks.filter((t) => t.area === area);
      if (!inArea.length) continue;
      const slots = new Map<number, number>();
      let maxSlots = 1;
      for (const t of inArea) {
        const c = depth.get(t.id)!;
        const s = slots.get(c) ?? 0;
        slots.set(c, s + 1);
        maxSlots = Math.max(maxSlots, s + 1);
        pos.set(t.id, { x: LEFT + c * (W + GX), y: y + LANE_PAD + s * (H + GY) });
      }
      const h = LANE_PAD * 2 + maxSlots * (H + GY) - GY;
      laneBox.push({ area, y, h });
      y += h + 10;
    }
    return { pos, laneBox, width: LEFT + cols * (W + GX), height: y };
  }, [tracks, areas]);

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const edges = useMemo(() => tracks.flatMap((t) => t.leads_to.filter((to) => byId.has(to)).map((to) => ({ from: t.id, to }))), [tracks, byId]);
  const picked = sel ? byId.get(sel) : null;
  const near = new Set<string>(sel ? [sel, ...edges.filter((e) => e.from === sel || e.to === sel).flatMap((e) => [e.from, e.to])] : []);

  return (
    <div className="dev-r-two">
      <div className="dev-r-diagram">
        <svg width={layout.width} height={layout.height} role="img" aria-label="Modules and how they lead to each other">
          <defs>
            <marker id="nx-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#58627c" />
            </marker>
          </defs>
          {layout.laneBox.map((l) => (
            <g key={l.area}>
              <rect x={4} y={l.y} width={layout.width - 8} height={l.h} rx={8} fill="#11141b" stroke="#222836" />
              <text className="lane" x={14} y={l.y + 22}>
                {l.area}
              </text>
            </g>
          ))}
          {edges.map((e, i) => {
            const a = layout.pos.get(e.from)!;
            const b = layout.pos.get(e.to)!;
            const x1 = a.x + W;
            const y1 = a.y + H / 2;
            const x2 = b.x;
            const y2 = b.y + H / 2;
            const mx = (x1 + x2) / 2;
            const hot = sel && (e.from === sel || e.to === sel);
            return <path key={i} className={`dev-r-edge${hot ? " is-hot" : ""}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} markerEnd="url(#nx-arrow)" />;
          })}
          {tracks.map((t) => {
            const p = layout.pos.get(t.id)!;
            const n = t.levels.length;
            const sw = Math.min(10, (W - 16) / Math.max(n, 1) - 2);
            return (
              <g key={t.id} className={`dev-r-node${sel === t.id ? " is-sel" : ""}${sel && !near.has(t.id) ? " is-dim" : ""}`} transform={`translate(${p.x},${p.y})`} data-dev-anchor={`track:${t.id}`} onClick={() => setSel(sel === t.id ? null : t.id)}>
                <title>{`${t.label} (${t.id})${t.gates.length ? `\nNeeds: ${t.gates.join(", ")}` : ""}`}</title>
                <rect className="box" width={W} height={H} rx={6} />
                <text x={8} y={16}>
                  {t.label.length > 27 ? `${t.label.slice(0, 26)}...` : t.label}
                </text>
                {t.levels.map((lv, i) => (
                  <rect key={i} x={8 + i * (sw + 2)} y={25} width={sw} height={7} rx={1.5} fill={levelOf(lv).color} />
                ))}
                {t.gates.length ? (
                  <text className="sub" x={8} y={H - 3}>
                    needs: {t.gates.join(", ").slice(0, 30)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <aside className="dev-r-side" aria-live="polite">
        {picked ? (
          <div data-dev-anchor={`track:${picked.id}`}>
            <h3>{picked.label}</h3>
            <p className="dev-r-muted" style={{ margin: 0 }}>
              <code>{picked.id}</code> · {picked.area}
            </p>
            <h4>Needs first</h4>
            <p style={{ margin: 0 }}>{picked.gates.length ? picked.gates.join(", ") : "Nothing"}</p>
            <h4>Usually leads to</h4>
            <ul>
              {picked.leads_to.length ? (
                picked.leads_to.map((t) => (
                  <li key={t}>
                    <button onClick={() => setSel(t)}>{byId.get(t)?.label ?? t}</button>
                  </li>
                ))
              ) : (
                <li className="dev-r-muted">Nothing: this is an end point.</li>
              )}
            </ul>
            <h4>Comes after</h4>
            <ul>
              {edges.filter((e) => e.to === picked.id).length ? (
                edges
                  .filter((e) => e.to === picked.id)
                  .map((e) => (
                    <li key={e.from}>
                      <button onClick={() => setSel(e.from)}>{byId.get(e.from)?.label ?? e.from}</button>
                    </li>
                  ))
              ) : (
                <li className="dev-r-muted">Nothing: this is a start point.</li>
              )}
            </ul>
            <h4>Steps ({picked.steps.length})</h4>
            <ul>
              {picked.steps.map((s, i) => (
                <li key={i}>
                  <span style={{ color: levelOf(s.level).color }}>●</span> {s.label}
                </li>
              ))}
            </ul>
            <h4>Used by courses</h4>
            <ul>
              {picked.courses.length ? (
                picked.courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/rails/${c.id}`} className="dev-r-link">
                      {c.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="dev-r-muted">No course uses it yet.</li>
              )}
            </ul>
          </div>
        ) : (
          <div>
            <h3>The trail map</h3>
            <p className="dev-r-muted">Each box is a module. An arrow means "usually comes next". Small squares are the steps inside, coloured by level. Click a box to see it.</p>
            <ul>
              {LEVELS.map((l) => (
                <li key={l.n}>
                  <span style={{ color: l.color }}>●</span> {l.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
