"use client";

import * as React from "react";
import { useWorkspace } from "../store";
import type { Course, Entry, Person } from "../types";
import { fmtDate, isMedia, kindLabel, stepTitle } from "./exportJournal";

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
  const { addComment } = useWorkspace();
  const [text, setText] = React.useState("");
  const uid = React.useId();
  const inputId = `ws-j-c-${uid}`;
  const st = stepTitle(course, entry);
  const media = isMedia(entry) && entry.kind !== "note";
  const personOf = (id: string) => people.find((p) => p.id === id);

  const send = (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = text.trim();
    if (!t) return;
    addComment(entry.id, t);
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
          <span className="ws-j-when">
            {fmtDate(entry.at)}
            {entry.minutes != null ? ` · ${entry.minutes} minutes` : ""}
            {entry.timestamp ? ` · at ${entry.timestamp}` : ""}
            {st ? ` · ${st}` : ""}
          </span>
          {isNew ? <span className="ws-j-new">new</span> : null}
        </div>
        {entry.text ? <p className="ws-j-card__text">{entry.text}</p> : null}
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
