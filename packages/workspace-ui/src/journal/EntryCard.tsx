"use client";

import * as React from "react";
import { useWorkspace } from "../store";
import type { Course, Entry, EntryVisibility, Person } from "../types";

const VIS_LABEL: Record<EntryVisibility, string> = { me: "Only me", guide: "Private (you and the guide)", circle: "Shared with the group" };
import { fmtDate, isMedia, kindLabel, stepTitle } from "./exportJournal";
import { GuideMark } from "../audience";

export interface EntryCardProps {
  entry: Entry;
  course: Course;
  people: Person[];
  /** Label above the comment box: "Reply" in the sheet, "Your comment" in the frame. */
  commentLabel: string;
  placeholder?: string;
  /** In the frame a media entry opens a pop-up. */
  onOpenMedia?: (e: Entry) => void;
  isNew?: boolean;
  canComment?: boolean;
}

export function EntryCard({ entry, course, people, commentLabel, placeholder, onOpenMedia, isNew, canComment = true }: EntryCardProps) {
  const ws = useWorkspace();
  const { addComment } = ws;
  const [err, setErr] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const uid = React.useId();
  const inputId = `ws-j-c-${uid}`;
  const st = stepTitle(course, entry);
  const media = isMedia(entry) && entry.kind !== "note";
  const personOf = (id: string) => people.find((p) => p.id === id);

  const send = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = text.trim();
    if (!t) return;
    setErr(null);
    const r = await addComment(entry.id, t);
    if (typeof r === "string") { setErr(r); return; }
    setText("");
  };

  const thumb = media ? (
    onOpenMedia ? (
      <button type="button" className="ws-j-thumb" onClick={() => onOpenMedia(entry)} aria-label={`Open ${entry.mediaLabel ?? kindLabel(entry)} larger`}>
        {entry.mediaLabel ?? kindLabel(entry)}
      </button>
    ) : (
      <div className="ws-j-thumb is-static">{entry.mediaLabel ?? kindLabel(entry)}</div>
    )
  ) : null;

  return (
    <article className={`ws-j-card${isNew ? " is-new" : ""}${media ? " has-media" : ""}`}>
      {thumb}
      <div className="ws-j-card__main">
        <div className="ws-j-card__meta">
          <span className="ws-j-kind">{kindLabel(entry)}</span>
          {ws.readOnly && personOf(entry.personId)?.role === "guide" ? <GuideMark /> : null}
          {ws.readOnly && entry.visibility ? <span className="ws-j-kind">{VIS_LABEL[entry.visibility]}</span> : null}
          <span className="ws-j-when">
            {fmtDate(entry.at)}
            {entry.minutes != null ? ` · ${entry.minutes} minutes` : ""}
            {entry.timestamp ? ` · at ${entry.timestamp}` : ""}
            {st ? ` · ${st}` : ""}
          </span>
          {isNew ? <span className="ws-j-new">new</span> : null}
        </div>
        {entry.text ? <p className="ws-j-card__text">{entry.text}</p> : null}
        {ws.readOnly && ws.canDo && entry.personId === ws.viewer.id && ws.doing ? (
          <div className="ws-j-reply__row">
            <label htmlFor={`${inputId}-v`}>Who can read this</label>
            <select id={`${inputId}-v`} value={entry.visibility ?? "me"} onChange={async (ev) => { setErr(null); const r = await ws.setEntryVisibility(entry.id, ev.target.value as EntryVisibility); if (r) setErr(r); }}>
              {ws.doing.visChoices.map((v) => <option key={v} value={v}>{VIS_LABEL[v]}</option>)}
            </select>
          </div>
        ) : null}
        {err ? <p className="ws-j-card__sub" role="alert">{err}</p> : null}
        {!media && entry.mediaLabel ? <p className="ws-j-card__sub">{entry.mediaLabel}</p> : null}

        {entry.comments.length > 0 ? (
          <ul className="ws-j-comments" aria-label="Comments">
            {entry.comments.map((c) => {
              const p = personOf(c.by);
              return (
                <li key={c.id} className="ws-j-comment">
                  <div className="ws-j-comment__by">
                    <strong>{p?.name ?? "Someone"}</strong>
                    {p?.role === "guide" ? " · guide" : ""} · {fmtDate(c.at)}
                  </div>
                  <div>{c.text}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="ws-j-card__sub">No comment yet</div>
        )}

        {canComment ? (
          <form className="ws-j-reply" onSubmit={send}>
            <label htmlFor={inputId}>{commentLabel}</label>
            <div className="ws-j-reply__row">
              <input id={inputId} type="text" value={text} placeholder={placeholder ?? "Write back…"} onChange={(e) => setText(e.target.value)} />
              <button type="submit" className="ws-j-btn" disabled={!text.trim()}>
                Send
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </article>
  );
}
