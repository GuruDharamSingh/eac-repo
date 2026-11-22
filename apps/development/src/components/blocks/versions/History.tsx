"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Config } from "@puckeditor/core";
import { themeList } from "@/lib/theme-store";
import type { VersionRow } from "@/lib/versions-types";
import { BlockShot } from "./BlockShot";

// ============================================================================
// History: the saved versions of one block, as lanes. Each lane is a branch
// (a "try"); each version is a dot with its note, time and a small picture. The
// lines show which version each one was made from, so a branch leaves its lane
// where it started. Click a version to look at it; "Continue from here" makes
// it the working copy; "Compare" puts two side by side or under a slider.
// No git words on screen: version, try, branch, keep, go back.
// ============================================================================

const PITCH = 184;
const CARD_W = 168;
const THUMB_W = 168;
const THUMB_H = 94;
const LANE_H = 214;
const PAD = 24;

const INK = "#1d2129";
const MUTED = "#667085";
const LINE = "#d0d5dd";
const ACCENT = "#1d4ed8";
const KEEP = "#b45309";
const BTN: CSSProperties = { font: "500 13px/1 system-ui, sans-serif", padding: "8px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${INK}`, background: "#fff", color: INK };
const BTN_PRIMARY: CSSProperties = { ...BTN, background: ACCENT, borderColor: ACCENT, color: "#fff" };

const LANE_COLOURS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#4d7c0f"];

export function whenText(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const themeLabel = (id: string | null) => (id ? themeList().find((t) => t.id === id)?.label ?? id : "The block's own look");

function propsOf(doc: unknown): Record<string, unknown> {
  return (doc as { content?: { props?: Record<string, unknown> }[] } | null)?.content?.[0]?.props ?? {};
}

/** Names of the settings that differ between two versions (plain words: what changed). */
export function changedSettings(a: VersionRow, b: VersionRow): string[] {
  const pa = propsOf(a.doc);
  const pb = propsOf(b.doc);
  const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  keys.delete("id");
  const out: string[] = [];
  for (const k of keys) if (JSON.stringify(pa[k] ?? null) !== JSON.stringify(pb[k] ?? null)) out.push(k);
  if ((a.theme ?? "") !== (b.theme ?? "")) out.push("theme");
  return out;
}

export function History({
  versions,
  baseId,
  config,
  title,
  onContinue,
  onKeep,
  onClose,
}: {
  versions: VersionRow[];
  baseId: string | null;
  config: Config;
  title: string;
  onContinue(v: VersionRow): void;
  onKeep(id: string, on: boolean): void;
  onClose(): void;
}) {
  const [a, setA] = useState<string | null>(baseId ?? versions[versions.length - 1]?.id ?? null);
  const [b, setB] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [slide, setSlide] = useState(50);

  const layout = useMemo(() => {
    const lanes: string[] = [];
    for (const v of versions) if (!lanes.includes(v.branch)) lanes.push(v.branch);
    const pos = new Map<string, { x: number; lane: number }>();
    versions.forEach((v, i) => pos.set(v.id, { x: PAD + i * PITCH, lane: lanes.indexOf(v.branch) }));
    return { lanes, pos, width: PAD * 2 + versions.length * PITCH, height: lanes.length * LANE_H + 8 };
  }, [versions]);

  const byId = useMemo(() => new Map(versions.map((v) => [v.id, v])), [versions]);
  const va = a ? byId.get(a) : undefined;
  const vb = b ? byId.get(b) : undefined;
  const dotY = (lane: number) => lane * LANE_H + 38;

  const pick = (id: string) => {
    if (comparing && a && id !== a) {
      setB(id);
      return;
    }
    setA(id);
    if (b === id) setB(null);
  };

  const parentOf = (v: VersionRow) => (v.parentId ? byId.get(v.parentId) : undefined);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "#f6f7f9", color: INK, display: "flex", flexDirection: "column", font: "13px/1.4 system-ui, sans-serif" }} data-dev-history>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${LINE}`, background: "#fff" }}>
        <strong style={{ fontSize: 15 }}>History: {title}</strong>
        <span style={{ color: MUTED }}>
          {versions.length} saved version{versions.length === 1 ? "" : "s"} on {layout.lanes.length} branch{layout.lanes.length === 1 ? "" : "es"}. Nothing here is ever overwritten.
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={BTN} onClick={onClose}>
          Back to editing
        </button>
      </div>

      {versions.length === 0 ? (
        <p style={{ padding: 24, color: MUTED }}>Nothing saved yet. Press &ldquo;Save version&rdquo; while you edit and each save appears here.</p>
      ) : (
        <>
          <div style={{ flex: "0 0 auto", maxHeight: "46%", overflow: "auto", borderBottom: `1px solid ${LINE}`, background: "#fbfbfc" }}>
            <div style={{ position: "relative", width: layout.width, height: layout.height }}>
              <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
                {layout.lanes.map((_, i) => (
                  <line key={i} x1={0} x2={layout.width} y1={i * LANE_H + LANE_H - 2} y2={i * LANE_H + LANE_H - 2} stroke="#eceef2" />
                ))}
                {versions.map((v) => {
                  const p = parentOf(v);
                  if (!p) return null;
                  const from = layout.pos.get(p.id)!;
                  const to = layout.pos.get(v.id)!;
                  const x1 = from.x + 10;
                  const y1 = dotY(from.lane);
                  const x2 = to.x + 10;
                  const y2 = dotY(to.lane);
                  const colour = LANE_COLOURS[to.lane % LANE_COLOURS.length];
                  return <path key={v.id} d={`M${x1} ${y1} C${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} fill="none" stroke={colour} strokeWidth={2} opacity={0.55} />;
                })}
              </svg>
              {layout.lanes.map((name, i) => {
                const first = versions.find((v) => v.branch === name)!;
                const kept = versions.some((v) => v.branch === name && v.kept);
                const from = parentOf(first);
                return (
                  <div key={name} style={{ position: "absolute", left: layout.pos.get(first.id)!.x, top: i * LANE_H + 4, font: "600 12px system-ui", color: LANE_COLOURS[i % LANE_COLOURS.length] }}>
                    {kept ? "★ " : ""}
                    {name}
                    {from ? <span style={{ fontWeight: 400, color: MUTED }}> (started from {from.note ? `"${from.note.slice(0, 24)}"` : "an earlier version"} on {from.branch})</span> : null}
                  </div>
                );
              })}
              {versions.map((v) => {
                const p = layout.pos.get(v.id)!;
                const colour = LANE_COLOURS[p.lane % LANE_COLOURS.length];
                const isA = v.id === a;
                const isB = v.id === b;
                const hasChild = versions.some((x) => x.parentId === v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pick(v.id)}
                    title={v.note || "(no note)"}
                    style={{
                      position: "absolute",
                      left: p.x,
                      top: p.lane * LANE_H + 28,
                      width: CARD_W,
                      textAlign: "left",
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      font: "inherit",
                      color: INK,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ display: "block", width: 20, height: 20, borderRadius: 10, background: v.kept ? KEEP : colour, border: `3px solid ${isA ? INK : isB ? "#be123c" : "#fff"}`, boxSizing: "border-box", marginBottom: 6, boxShadow: `0 0 0 1px ${LINE}` }}
                    />
                    <span style={{ display: "block", border: `2px solid ${isA ? INK : isB ? "#be123c" : LINE}`, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                      <BlockShot config={config} doc={v.doc} theme={v.theme} width={THUMB_W - 4} height={THUMB_H} lazy />
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.kept ? "★ " : ""}
                      {v.note || "Saved version"}
                    </span>
                    <span style={{ display: "block", color: MUTED, fontSize: 12 }}>
                      {whenText(v.createdAt)}
                      {v.author ? ` · ${v.author}` : ""}
                      {hasChild ? "" : " · latest here"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: "1 1 auto", overflow: "auto", padding: 16 }}>
            {va ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>{va.note || "Saved version"}</strong>
                  <span style={{ color: MUTED }}>
                    {va.branch} &middot; {whenText(va.createdAt)}
                    {va.author ? ` · ${va.author}` : ""} &middot; look: {themeLabel(va.theme)}
                    {va.id === baseId ? " · you are working from this one" : ""}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button type="button" style={BTN_PRIMARY} onClick={() => onContinue(va)} title="Make this the working copy. If you save from here and it already has a later version, a new branch starts.">
                    Continue from here
                  </button>
                  <button type="button" style={BTN} onClick={() => onKeep(va.id, !va.kept)} title="Mark the favourite. Only one version per block is kept.">
                    {va.kept ? "★ Kept (undo)" : "Keep this one"}
                  </button>
                  <button
                    type="button"
                    style={comparing ? { ...BTN, background: "#fef3c7", borderColor: KEEP } : BTN}
                    onClick={() => {
                      setComparing((c) => !c);
                      setB(null);
                    }}
                  >
                    {comparing ? "Stop comparing" : "Compare with another"}
                  </button>
                </div>

                {comparing && !vb ? <p style={{ color: KEEP, margin: "0 0 12px" }}>Now click a second version above to compare it with this one.</p> : null}

                {comparing && vb ? (
                  <>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <button type="button" style={mode === "side" ? BTN_PRIMARY : BTN} onClick={() => setMode("side")}>
                        Side by side
                      </button>
                      <button type="button" style={mode === "slider" ? BTN_PRIMARY : BTN} onClick={() => setMode("slider")}>
                        Slider
                      </button>
                      <span style={{ color: MUTED }}>
                        {(() => {
                          const c = changedSettings(va, vb);
                          return c.length ? `What differs: ${c.join(", ")}` : "The settings are the same (only the looks or layout may differ).";
                        })()}
                      </span>
                    </div>
                    {mode === "side" ? (
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {[va, vb].map((v, i) => (
                          <figure key={v.id} style={{ margin: 0 }}>
                            <figcaption style={{ font: "600 12px system-ui", marginBottom: 4, color: i === 0 ? INK : "#be123c" }}>
                              {i === 0 ? "A" : "B"}: {v.note || "Saved version"} ({v.branch})
                            </figcaption>
                            <div style={{ border: `2px solid ${i === 0 ? INK : "#be123c"}` }}>
                              <BlockShot config={config} doc={v.doc} theme={v.theme} width={520} height={340} />
                            </div>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <div style={{ position: "relative", width: 760, height: 380, border: `2px solid ${INK}`, overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0 }}>
                            <BlockShot config={config} doc={va.doc} theme={va.theme} width={756} height={376} />
                          </div>
                          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${slide}%)` }}>
                            <BlockShot config={config} doc={vb.doc} theme={vb.theme} width={756} height={376} />
                          </div>
                          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${slide}%`, width: 2, background: "#be123c" }} />
                        </div>
                        <input type="range" min={0} max={100} value={slide} onChange={(e) => setSlide(Number(e.target.value))} style={{ width: 760, display: "block", marginTop: 8 }} aria-label="Slide between the two versions" />
                        <div style={{ display: "flex", justifyContent: "space-between", width: 760, color: MUTED, font: "12px system-ui" }}>
                          <span>A (left): {va.note || "Saved version"}</span>
                          <span>B (right): {vb.note || "Saved version"}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ border: `1px solid ${LINE}`, width: 760 }}>
                    <BlockShot config={config} doc={va.doc} theme={va.theme} width={758} height={380} />
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: MUTED }}>Click a version above to look at it.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
