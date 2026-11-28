"use client";

import { useState } from "react";
import { Layer } from "./layer";
import { draftFor, useStageEdit } from "./stage-edit-store";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Guide notes are stored as sanitised HTML: shown as plain paragraphs, written back as paragraphs. */
const toText = (html: string) =>
  html
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** Stop settings for the shown stop: name, minutes, guide notes (team only) and removal from the route. */
export function StopSettings({ stopId, onClose }: { stopId: string; onClose: () => void }) {
  const edit = useStageEdit();
  const api = edit?.api ?? null;
  const mine = draftFor(api, stopId);
  const [name, setName] = useState(mine?.draft.title ?? "");
  const [mins, setMins] = useState(mine?.draft.durationMinutes ?? "");
  const [notes, setNotes] = useState(toText(mine?.draft.guideNotes ?? ""));
  const [busy, setBusy] = useState(false);
  if (!api || !mine) return null;
  const { draft, index } = mine;
  const notesChanged = notes !== toText(draft.guideNotes);
  const dirty = name.trim() !== draft.title || mins.trim() !== draft.durationMinutes || notesChanged;

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const next = api!.stops.map((s, i) =>
      i === index ? { ...s, title: name.trim(), durationMinutes: mins.trim(), guideNotes: notesChanged ? toHtml(notes) : s.guideNotes, dirty: true } : s
    );
    const ok = await api!.commit({ stops: next });
    setBusy(false);
    if (ok) onClose();
  }
  async function remove() {
    if (!window.confirm(`Take "${draft.title}" off the route? Its pictures stay with the place.`)) return;
    setBusy(true);
    const nextLines = { ...api!.narratives };
    delete nextLines[draft.key];
    const ok = await api!.commit({ stops: api!.stops.filter((_, i) => i !== index), narratives: nextLines });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Layer title={`Stop settings · stop ${index + 1}`} onClose={onClose}>
      <div className="tse-form">
        <label className="tse-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="tse-field">
          <span>Minutes here</span>
          <input inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <label className="tse-field">
          <span>Guide notes</span>
          <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <small>Only the team sees this</small>
        </label>
        <div className="tse-row">
          <button type="button" className="tse-btn tse-btn--primary" onClick={() => void save()} disabled={busy || !dirty || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="tse-btn tse-btn--danger" onClick={() => void remove()} disabled={busy}>
            Remove from route
          </button>
        </div>
      </div>
    </Layer>
  );
}
