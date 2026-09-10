"use client";

import * as React from "react";
import type { ContentComposerSlots } from "./ContentComposer";

// ============================================================================
// The sessions a workshop has, edited in place.
//
// A workshop is a series. Each session is a title, a time, how long, where
// (or online), a few lines about it, and — because a series reads as
// chapters — its own image and its own background colour. The image comes
// through the host's media slot, so it is always something in the org's own
// storage, never a pasted URL (settled rule, 2026-09-07).
//
// The value is a plain array in the answers, keyed `sessions`, in the shape
// `WorkshopSessionInput` in @elkdonis/services expects; the host's adapter
// passes it through.
// ============================================================================

/**
 * One thing attached to a session: a handout, a recording, a reading, a
 * link. `isPublic` decides whether it is on the open page or only for the
 * people in the workshop — the same rule the materials folder follows.
 * Shape is `WorkshopSessionResource` in @elkdonis/services.
 */
export interface SessionResourceDraft {
  id: string;
  title: string;
  type: "link" | "pdf" | "video" | "audio" | "doc" | "other";
  url: string;
  isPublic: boolean;
  description?: string;
}

export interface SessionDraft {
  id?: string;
  title: string;
  description?: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  isOnline?: boolean;
  location?: string;
  videoConferenceUrl?: string;
  mediaUrl?: string | null;
  backgroundColor?: string | null;
  resources?: SessionResourceDraft[];
}

/** What a resource is, read off its address — nobody should have to say. */
export function resourceTypeFor(url: string): SessionResourceDraft["type"] {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (/\.pdf$/.test(path)) return "pdf";
  if (/\.(mp4|webm|mov|m4v)$/.test(path) || /youtu\.?be|vimeo\.com/.test(path)) return "video";
  if (/\.(mp3|wav|m4a|ogg|flac)$/.test(path)) return "audio";
  if (/\.(docx?|odt|rtf|txt|md|pptx?|xlsx?|epub)$/.test(path)) return "doc";
  if (/^https?:\/\//.test(url) && !/\/api\/media\//.test(url)) return "link";
  return url ? "other" : "link";
}

export function SessionsEditor({
  value,
  onChange,
  media,
}: {
  value: unknown;
  onChange: (value: SessionDraft[]) => void;
  media?: ContentComposerSlots["media"];
}) {
  const sessions: SessionDraft[] = Array.isArray(value) ? (value as SessionDraft[]) : [];
  const [open, setOpen] = React.useState<number | null>(sessions.length ? 0 : null);

  function update(index: number, patch: Partial<SessionDraft>) {
    onChange(sessions.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function add() {
    const last = sessions[sessions.length - 1];
    onChange([
      ...sessions,
      {
        title: "",
        durationMinutes: last?.durationMinutes ?? 90,
        isOnline: last?.isOnline ?? true,
        location: last?.location ?? "",
        scheduledAt: nextWeek(last?.scheduledAt),
      },
    ]);
    setOpen(sessions.length);
  }
  function remove(index: number) {
    onChange(sessions.filter((_, i) => i !== index));
    setOpen(null);
  }
  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= sessions.length) return;
    const next = sessions.slice();
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
    setOpen(to);
  }

  return (
    <div className="eac-sessions">
      {sessions.length === 0 && <p className="eac-surface-muted">No sessions yet — a workshop with none is a single gathering.</p>}
      <ol className="eac-sessions-list">
        {sessions.map((s, i) => (
          <li key={i} className={`eac-session${open === i ? " is-open" : ""}`} style={{ borderLeftColor: s.backgroundColor || undefined }}>
            <button type="button" className="eac-session-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className="eac-session-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="eac-session-title">{s.title || "Untitled session"}</span>
              <span className="eac-session-meta">
                {[s.scheduledAt && s.scheduledAt.replace("T", " · "), s.durationMinutes && `${s.durationMinutes} min`].filter(Boolean).join(" · ")}
              </span>
            </button>
            {open === i && (
              <div className="eac-session-body">
                <div className="eac-field">
                  <label className="eac-field-label" htmlFor={`ss-title-${i}`}>Title</label>
                  <input id={`ss-title-${i}`} className="eac-input" value={s.title} placeholder={`Session ${i + 1}`} onChange={(e) => update(i, { title: e.target.value })} />
                </div>
                <div className="eac-field-row">
                  <div className="eac-field">
                    <label className="eac-field-label" htmlFor={`ss-when-${i}`}>When</label>
                    <input id={`ss-when-${i}`} type="datetime-local" className="eac-input" value={s.scheduledAt ?? ""} onChange={(e) => update(i, { scheduledAt: e.target.value || null })} />
                  </div>
                  <div className="eac-field">
                    <label className="eac-field-label" htmlFor={`ss-len-${i}`}>Minutes</label>
                    <input id={`ss-len-${i}`} type="number" min={5} step={5} className="eac-input" value={s.durationMinutes ?? ""} onChange={(e) => update(i, { durationMinutes: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <div className="eac-field-row">
                  <div className="eac-field">
                    <button type="button" role="switch" aria-checked={Boolean(s.isOnline)} className="eac-toggle" onClick={() => update(i, { isOnline: !s.isOnline })}>
                      <span className="eac-toggle-track" aria-hidden />
                      <span><b style={{ fontWeight: 500 }}>Online</b><span className="eac-toggle-text"> — uses the workshop's Talk room</span></span>
                    </button>
                  </div>
                  {!s.isOnline && (
                    <div className="eac-field">
                      <label className="eac-field-label" htmlFor={`ss-where-${i}`}>Where</label>
                      <input id={`ss-where-${i}`} className="eac-input" value={s.location ?? ""} onChange={(e) => update(i, { location: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="eac-field">
                  <label className="eac-field-label" htmlFor={`ss-desc-${i}`}>About this session</label>
                  <textarea id={`ss-desc-${i}`} rows={3} className="eac-input eac-input--textarea" value={s.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} />
                </div>
                <div className="eac-field-row">
                  {media && (
                    <div className="eac-field">
                      {media({
                        value: s.mediaUrl ?? "",
                        onChange: (v) => update(i, { mediaUrl: typeof v === "string" && v ? v : null }),
                        label: "Session image",
                        hint: "Shown whole within the session, never cropped.",
                      })}
                    </div>
                  )}
                  <div className="eac-field">
                    <label className="eac-field-label" htmlFor={`ss-col-${i}`}>Background colour</label>
                    <div className="eac-color">
                      <input id={`ss-col-${i}`} type="color" value={s.backgroundColor || "#fffdf8"} onChange={(e) => update(i, { backgroundColor: e.target.value })} />
                      <button type="button" className="eac-btn eac-btn--quiet" onClick={() => update(i, { backgroundColor: null })} disabled={!s.backgroundColor}>Clear</button>
                    </div>
                  </div>
                </div>
                <SessionResources
                  value={s.resources ?? []}
                  onChange={(resources) => update(i, { resources })}
                  media={media}
                  idPrefix={`ss-res-${i}`}
                />
                <div className="eac-session-tools">
                  <button type="button" className="eac-btn eac-btn--quiet" onClick={() => move(i, -1)} disabled={i === 0}>↑ Earlier</button>
                  <button type="button" className="eac-btn eac-btn--quiet" onClick={() => move(i, 1)} disabled={i === sessions.length - 1}>↓ Later</button>
                  <button type="button" className="eac-btn eac-btn--quiet eac-btn--danger" onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="eac-board-add" style={{ margin: 0 }} onClick={add}>+ Add a session</button>
    </div>
  );
}

/**
 * The files and links a session carries.
 *
 * Two ways in: paste an address, or — when the host gives us its picker —
 * choose or upload a file into the org's own storage, which is what makes a
 * handout land in the materials folder rather than on someone's laptop. Each
 * row says whether it is on the open page or for participants only.
 */
function SessionResources({
  value,
  onChange,
  media,
  idPrefix,
}: {
  value: SessionResourceDraft[];
  onChange: (value: SessionResourceDraft[]) => void;
  media?: ContentComposerSlots["media"];
  idPrefix: string;
}) {
  const [pickingFor, setPickingFor] = React.useState<number | null>(null);

  function patch(index: number, changes: Partial<SessionResourceDraft>) {
    onChange(
      value.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...changes };
        // Retype when the address changes unless the author has overridden it.
        if (changes.url !== undefined && !changes.type) next.type = resourceTypeFor(next.url);
        return next;
      })
    );
  }
  function add() {
    onChange([
      ...value,
      { id: newId(), title: "", type: "link", url: "", isPublic: false },
    ]);
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
    if (pickingFor === index) setPickingFor(null);
  }

  return (
    <div className="eac-resources">
      <span className="eac-field-label">Files &amp; links for this session</span>
      {value.length === 0 && (
        <p className="eac-surface-muted" style={{ margin: "0.25rem 0 0.5rem" }}>
          Nothing attached yet — a handout, a reading, a recording.
        </p>
      )}
      <ul className="eac-resources-list">
        {value.map((r, i) => (
          <li key={r.id} className="eac-resource">
            <div className="eac-resource-row">
              <input
                id={`${idPrefix}-title-${i}`}
                className="eac-input"
                placeholder="What is it?"
                aria-label="Title"
                value={r.title}
                onChange={(e) => patch(i, { title: e.target.value })}
              />
              <select
                className="eac-input eac-resource-type"
                aria-label="Kind"
                value={r.type}
                onChange={(e) => patch(i, { type: e.target.value as SessionResourceDraft["type"] })}
              >
                <option value="link">Link</option>
                <option value="pdf">PDF</option>
                <option value="doc">Document</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="eac-resource-row">
              <input
                className="eac-input"
                type="url"
                placeholder="https:// — or choose a file"
                aria-label="Address"
                value={r.url}
                onChange={(e) => patch(i, { url: e.target.value })}
              />
              {media && (
                <button
                  type="button"
                  className="eac-btn eac-btn--quiet"
                  onClick={() => setPickingFor(pickingFor === i ? null : i)}
                  aria-expanded={pickingFor === i}
                >
                  {pickingFor === i ? "Done" : r.url ? "Replace file" : "Choose a file"}
                </button>
              )}
            </div>
            {media && pickingFor === i && (
              <div className="eac-resource-picker">
                {media({
                  value: r.url,
                  onChange: (v) => {
                    if (typeof v === "string" && v) {
                      patch(i, { url: v, title: r.title || nameFromUrl(v) });
                      setPickingFor(null);
                    }
                  },
                  label: "File",
                  hint: "Goes into the org's storage, where the materials folder can also see it.",
                  accept: "*/*",
                })}
              </div>
            )}
            <div className="eac-resource-row eac-resource-foot">
              <button
                type="button"
                role="switch"
                aria-checked={r.isPublic}
                className="eac-toggle"
                onClick={() => patch(i, { isPublic: !r.isPublic })}
              >
                <span className="eac-toggle-track" aria-hidden />
                <span>
                  <b style={{ fontWeight: 500 }}>{r.isPublic ? "On the open page" : "Participants only"}</b>
                  <span className="eac-toggle-text">
                    {r.isPublic ? " — anyone can open it" : " — unlocked by joining"}
                  </span>
                </span>
              </button>
              <button type="button" className="eac-btn eac-btn--quiet eac-btn--danger" onClick={() => remove(i)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="eac-board-add" style={{ margin: 0 }} onClick={add}>
        + Attach a file or link
      </button>
    </div>
  );
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
}

/** "…/1784760242290-PosterV1EAC.jpeg" → "PosterV1EAC.jpeg" */
function nameFromUrl(url: string): string {
  const last = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() ?? "");
  return last.replace(/^\d{10,}-/, "");
}

/** A week after the previous session, same time — the common case for a series. */
function nextWeek(prev?: string | null): string {
  if (!prev) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(prev);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${m[4]}`;
}
