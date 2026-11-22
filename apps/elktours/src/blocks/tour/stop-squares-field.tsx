"use client";

import * as React from "react";
import { FieldLabel, useGetPuck } from "@puckeditor/core";
import { useTourPage } from "./context";
import {
  STAGE_CAPTION_MAX,
  STAGE_LEAD,
  STAGE_MEDIA,
  cleanOverride,
  cleanPerStop,
  readStageOptions,
  type StopOverride,
} from "./stage-options";

// ============================================================================
// "Stops" — per-stop settings for the Hero stage, as a grid of squares.
//
// Modelled on danamccool's "Arrange tiles" field (tile-arrange-field.tsx): a
// custom Puck field that reads the tiles from outside the block's own props
// (there, the selected block's Tile rows; here, the sample tour's stops from
// the page context) and stores only the settings, keyed by tile (stop id).
// Global defaults stay first-class: a square with nothing set follows the
// block's own selects above ("Same as page"), and setting it back removes the
// key. The layout is shared by every tour: overrides for stop ids the sample
// tour does not have are kept untouched and shown only as a count.
// ============================================================================

const SAME = "";
type Row = { id: string; title: string; picture: string | null; narrative: string | null };

const box: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))", gap: 8 };
const sel: React.CSSProperties = { width: "100%", fontSize: 12, padding: "2px 4px", border: "1px solid #c8c8c8", borderRadius: 4, background: "#fff" };
const small: React.CSSProperties = { fontSize: 11, color: "#666", margin: 0 };

export function StopSquaresField({ value, onChange, readOnly }: { value?: unknown; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const page = useTourPage();
  const getPuck = useGetPuck();
  const perStop = cleanPerStop(value);

  const tour = page?.tour;
  // The line the page will show: STAGE's narrative (excerpt, else the start of the body) when computed.
  const stage = (page as unknown as { stage?: { byStop?: Record<string, { narrative: string | null }> } } | null)?.stage;
  const rows: Row[] = (tour?.stops ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    picture: s.stillUrl ?? s.imageUrl ?? null,
    narrative: stage?.byStop?.[s.id]?.narrative ?? null,
  }));
  const here = new Set(rows.map((r) => r.id));
  const elsewhere = Object.keys(perStop).filter((id) => !here.has(id)).length;

  // The block's own settings, for the "Same as page (…)" hints.
  const globals = readStageOptions((getPuck().selectedItem?.props ?? {}) as Record<string, unknown>);
  const mediaName = (v: string) => STAGE_MEDIA.find((o) => o.value === v)?.label ?? v;
  const leadName = (v: string) => STAGE_LEAD.find((o) => o.value === v)?.label ?? v;

  const set = (id: string, patch: Partial<Record<keyof StopOverride, unknown>>) => {
    const merged = { ...(perStop[id] ?? {}), ...patch } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined || merged[k] === SAME || merged[k] === false) delete merged[k];
    const next = { ...perStop };
    const clean = cleanOverride(merged);
    if (clean) next[id] = clean;
    else delete next[id];
    onChange(next);
  };

  return (
    <FieldLabel label="Stops" el="div">
      <div style={{ display: "grid", gap: 8 }}>
        {!tour ? (
          <p style={small}>Open the layout editor over a tour to set its stops.</p>
        ) : rows.length === 0 ? (
          <p style={small}>The sample tour has no stops yet. Add them on the Route step of the Create a tour wizard.</p>
        ) : (
          <>
            <p style={small}>
              Each square is a stop of the sample tour. Leave a setting on "Same as page" to follow the choices above; only changes are stored.
              Settings are kept per stop, so they apply to this tour's stops; another tour's stops follow the page settings.
            </p>
            <div style={box}>
              {rows.map((r, i) => {
                const o = perStop[r.id] ?? {};
                const hidden = o.hidden === true;
                const touched = Object.keys(o).length > 0;
                return (
                  <div key={r.id} style={{ border: "1px solid #d4d4d4", borderRadius: 6, padding: 6, display: "grid", gap: 4, background: touched ? "#fffbea" : "#fff", opacity: hidden ? 0.65 : 1 }}>
                    <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                      {r.picture ? <img src={r.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: hidden ? "grayscale(1)" : undefined }} /> : null}
                      <span style={{ position: "absolute", top: 4, left: 4, background: "#111", color: "#fff", fontSize: 11, borderRadius: 10, padding: "0 6px" }}>{i + 1}</span>
                      {hidden ? <span style={{ position: "absolute", inset: "auto 4px 4px auto", background: "#fff", fontSize: 11, padding: "0 5px", borderRadius: 3 }}>Hidden</span> : null}
                    </div>
                    <strong style={{ fontSize: 12, lineHeight: 1.2 }}>{r.title}</strong>
                    {r.narrative ? <p style={{ ...small, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.narrative}</p> : <p style={small}>No stop line yet.</p>}
                    <label style={small}>
                      Pictures from
                      <select disabled={readOnly} style={sel} value={o.media ?? SAME} onChange={(e) => set(r.id, { media: e.target.value })}>
                        <option value={SAME}>Same as page ({mediaName(globals.media)})</option>
                        {STAGE_MEDIA.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={small}>
                      Opens on
                      <select disabled={readOnly} style={sel} value={o.lead ?? SAME} onChange={(e) => set(r.id, { lead: e.target.value })}>
                        <option value={SAME}>Same as page ({leadName(globals.lead)})</option>
                        {STAGE_LEAD.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={small}>
                      Caption
                      <input
                        disabled={readOnly}
                        style={sel}
                        maxLength={STAGE_CAPTION_MAX}
                        placeholder="Stop's name"
                        defaultValue={o.caption ?? ""}
                        key={`${r.id}:${o.caption ?? ""}`}
                        onBlur={(e) => e.target.value.trim() !== (o.caption ?? "") && set(r.id, { caption: e.target.value.trim() || undefined })}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" disabled={readOnly} style={{ ...sel, cursor: "pointer", flex: 1 }} onClick={() => set(r.id, { hidden: hidden ? false : true })} aria-pressed={hidden}>
                        {hidden ? "Show stop" : "Hide stop"}
                      </button>
                      {touched ? (
                        <button type="button" disabled={readOnly} style={{ ...sel, cursor: "pointer", flex: 1 }} onClick={() => set(r.id, { media: SAME, lead: SAME, hidden: false, caption: undefined })}>
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {elsewhere > 0 ? <p style={small}>{elsewhere} setting{elsewhere === 1 ? "" : "s"} for stops that are not on this sample tour {elsewhere === 1 ? "is" : "are"} kept.</p> : null}
          </>
        )}
      </div>
    </FieldLabel>
  );
}
