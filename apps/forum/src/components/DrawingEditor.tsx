"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

// Excalidraw touches window at module load, so the component AND its helper
// functions are loaded client-side only — the component through next/dynamic,
// the helpers through import() inside handlers.
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((m) => m.Excalidraw), { ssr: false });

export interface SeedNode { id: string; title: string; kind: string; href: string | null; centre?: boolean }
export interface SeedEdge { from: string; to: string; kind: string }

export interface DrawingEditorProps {
  mode: "new" | "edit";
  /** Edit mode: the drawing's thread id. */
  id?: string;
  initialTitle: string;
  initialCaption: string;
  /** Edit mode: the saved scene. */
  initialScene?: { elements: unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> } | null;
  /** New mode, drawn over a map: the skeleton to start from. */
  seed?: { nodes: SeedNode[]; edges: SeedEdge[] } | null;
  /** New mode: where it may be posted, as `orgId|feedSlug`. */
  targets: Array<{ value: string; label: string }>;
  defaultTarget?: string | null;
  /** New mode: the thread this is drawn over; the drawing will cite it. */
  from?: string | null;
  cancelHref: string;
}

/**
 * The drawing editor: Excalidraw on a page of its own, with a title, a
 * place to post, and one Save. Saving exports the scene to SVG here in the
 * browser — Excalidraw's own exporter, font subsets inlined — and sends
 * both to the host, which stores the scene for editing and serves the SVG
 * as the picture everyone else sees.
 *
 * A seed (drawn over a thread's map) is laid out on a ring the same way the
 * server's SVG map is, as real elements you can move, restyle and draw
 * around; each node keeps a link to its thread.
 */
export function DrawingEditor(p: DrawingEditorProps) {
  const [api, setApi] = React.useState<any>(null);
  const [initial, setInitial] = React.useState<any | null | undefined>(undefined);
  const [title, setTitle] = React.useState(p.initialTitle);
  const [caption, setCaption] = React.useState(p.initialCaption);
  const [target, setTarget] = React.useState(p.defaultTarget ?? p.targets[0]?.value ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Build the initial scene once, client-side: a saved scene as it is, a seed
  // through Excalidraw's skeleton converter, or nothing.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (p.initialScene) {
        setInitial({
          elements: p.initialScene.elements,
          appState: { ...(p.initialScene.appState ?? {}), collaborators: new Map() },
          files: p.initialScene.files,
          scrollToContent: true,
        });
        return;
      }
      if (p.seed && p.seed.nodes.length > 0) {
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
        const elements = convertToExcalidrawElements(skeletonFor(p.seed) as any);
        if (!cancelled) setInitial({ elements, appState: { viewBackgroundColor: "#ffffff", collaborators: new Map() }, scrollToContent: true });
        return;
      }
      setInitial({ elements: [], appState: { viewBackgroundColor: "#ffffff", collaborators: new Map() } });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!api) return;
    if (!title.trim()) { setError("Give the drawing a title."); return; }
    if (p.mode === "new" && !target) { setError("Pick where it belongs."); return; }
    setSaving(true); setError(null);
    try {
      const elements = api.getSceneElements();
      if (elements.length === 0) { setError("Draw something first."); setSaving(false); return; }
      const appState = api.getAppState();
      const files = api.getFiles();
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const svgEl = await exportToSvg({
        elements,
        appState: { ...appState, exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false },
        files,
        exportPadding: 24,
      });
      const svg = svgEl.outerHTML;
      const scene = {
        elements: Array.from(elements),
        // Only what redrawing needs — not a viewer's cursor, zoom or selection.
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files,
      };
      const [orgId, feedSlug] = target.split("|");
      const res = await fetch(p.mode === "new" ? "/api/drawing" : `/api/drawing/${p.id}`, {
        method: p.mode === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, caption, scene, svg, orgId, feedSlug, from: p.from ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Couldn't save."); setSaving(false); return; }
      window.location.href = data.href;
    } catch (err) {
      setError((err as Error).message || "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <div className="gf-draw">
      <div className="gf-draw-head">
        <input className="gf-input gf-draw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" maxLength={200} />
        {p.mode === "new" && (
          p.targets.length === 1 ? null : (
            <select className="gf-input gf-select gf-draw-target" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Where it belongs">
              {p.targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )
        )}
        <input className="gf-input gf-draw-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A line under the picture (optional)" aria-label="Caption" maxLength={500} />
        <span className="gf-draw-actions">
          <a className="gf-tool" href={p.cancelHref}>Cancel</a>
          <button type="button" className="eac-btn eac-btn--primary" onClick={save} disabled={saving || !api}>{saving ? "Saving…" : p.mode === "new" ? "Post drawing" : "Save"}</button>
        </span>
      </div>
      {error && <p className="gf-flash gf-flash--error" role="alert">{error}</p>}
      <div className="gf-draw-canvas">
        {initial === undefined ? (
          <p className="gf-empty">Loading the canvas…</p>
        ) : (
          <Excalidraw excalidrawAPI={(a: any) => setApi(a)} initialData={initial} UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }} />
        )}
      </div>
      <p className="gf-draw-hint">Saving exports the picture as it looks now; the drawing stays editable here. Nodes from a map keep a link to their thread — select one and press the link tool to follow it.</p>
    </div>
  );
}

/**
 * The skeleton a map becomes: an ellipse per node (the centre larger), an
 * arrow per edge, in Excalidraw's own strokes for the same four kinds the
 * server's map draws. Laid out on a ring like the SVG, so what you saw is
 * what you start from.
 */
function skeletonFor(seed: { nodes: SeedNode[]; edges: SeedEdge[] }): unknown[] {
  const ring = seed.nodes.filter((n) => !n.centre);
  const centre = seed.nodes.find((n) => n.centre) ?? null;
  const R = Math.max(260, 40 + ring.length * 36);
  const W = 170, H = 64;
  const pos = new Map<string, { x: number; y: number }>();
  ring.forEach((n, i) => {
    const a = -Math.PI / 2 + (i / Math.max(ring.length, 1)) * Math.PI * 2;
    pos.set(n.id, { x: Math.cos(a) * R - W / 2, y: Math.sin(a) * R - H / 2 });
  });
  if (centre) pos.set(centre.id, { x: -W / 2, y: -H / 2 });

  const out: unknown[] = [];
  for (const n of seed.nodes) {
    const at = pos.get(n.id)!;
    out.push({
      type: "ellipse",
      id: `node-${n.id}`,
      x: at.x, y: at.y, width: W, height: H,
      strokeColor: "#3b5b7a",
      backgroundColor: n.centre ? "#3b5b7a" : "#ffffff",
      fillStyle: "solid",
      strokeWidth: n.centre ? 2 : 1,
      roughness: 1,
      link: n.href,
      label: { text: n.title.length > 28 ? `${n.title.slice(0, 27)}…` : n.title, fontSize: 16, strokeColor: n.centre ? "#ffffff" : "#1b2129" },
    });
  }
  for (const e of seed.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const directed = e.kind !== "topic" && e.kind !== "line";
    out.push({
      type: "arrow",
      x: a.x + W / 2, y: a.y + H / 2,
      width: b.x - a.x, height: b.y - a.y,
      strokeColor: e.kind === "topic" ? "#a9b3bd" : e.kind === "mentions" ? "#8a94a0" : "#3b5b7a",
      strokeStyle: e.kind === "line" ? "dashed" : e.kind === "mentions" ? "dotted" : "solid",
      strokeWidth: e.kind === "topic" ? 1 : 2,
      roughness: 1,
      endArrowhead: directed ? "arrow" : null,
      startArrowhead: null,
      start: { id: `node-${e.from}` },
      end: { id: `node-${e.to}` },
    });
  }
  return out;
}
