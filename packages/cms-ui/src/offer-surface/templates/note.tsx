"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { dateBlock } from "../format";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateProps, TemplatePiece } from "./types";

// Note page (packet frame 2i): a timeline of notes on the left, the current
// note on the right with its replies in the page.

const stamp = (iso: string | null | undefined) => {
  if (!iso) return null;
  const b = dateBlock(iso, "UTC");
  return { short: `${b.day.padStart(2, "0")} ${b.month}`, long: `${b.day.padStart(2, "0")} ${b.month} ${new Date(iso).getUTCFullYear()}` };
};

export function NoteTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const [reply, setReply] = React.useState("");
  const note: TemplatePiece | undefined = data.pieces[0];
  if (!note) {
    return (
      <TemplateShell data={data} template="note">
        <div className="ost-note-empty">No notes yet.</div>
      </TemplateShell>
    );
  }
  // Newest first, the current note marked wherever it falls.
  // Capped at 8 (the note itself always among them) for an author with many notes.
  const newest = [...data.pieces].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const line = newest.length > 8 ? newest.filter((p) => p.key === note.key || newest.filter((q) => q.key !== note.key).slice(0, 7).includes(p)) : newest;
  const byAuthor = !data.placeholders && note.authorId ? (data.people[note.authorId] ?? data.owner).name : "";
  const when = stamp(note.date);
  const replies = note.replies ?? [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = note.bodyHtml ?? (note.standfirst ? `<p>${esc(note.standfirst)}</p>` : "");

  return (
    <TemplateShell data={data} template="note">
      <div className="ost-note">
        <nav className="ost-note-line" aria-label="Notes">
          <ol className="ost-note-line-list">
            {line.map((p) => {
              const cur = p.key === note.key;
              const s = stamp(p.date);
              const inner = (
                <>
                  <span className="ost-note-dot" aria-hidden />
                  <span className="ost-note-pt-text">
                    <span className="ost-note-pt-date">{s?.short}</span>
                    <span className="ost-note-pt-title">{cur ? "This note" : p.title}</span>
                  </span>
                </>
              );
              return (
                <li key={p.key}>
                  {cur ? (
                    <div className="ost-note-pt is-current" aria-current="true">
                      {inner}
                    </div>
                  ) : (
                    <button type="button" className="ost-note-pt" onClick={(e) => open(offerDescriptor("wr-read", p.key), e.currentTarget)}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <article className="ost-note-main">
          <span className="ost-note-meta">{[when?.long, "NOTE", byAuthor ? `BY ${byAuthor.toUpperCase()}` : ""].filter(Boolean).join(" · ")}</span>
          <h1 className="ost-note-title">{note.title}</h1>
          {text && <OstBody className="ost-note-text" data={data} html={text} />}
          {(note.picture || data.placeholders) && (
            <div className={`ost-note-pic${note.picture ? " is-real" : " osf-ph"}`}>
              {note.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={note.picture} alt={note.caption ?? ""} />
              ) : (
                "picture"
              )}
            </div>
          )}
          {note.tags && note.tags.length > 0 && (
            <div className="ost-note-tags">
              {note.tags.map((t) => (
                <span key={t} className="ost-note-tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <section className="ost-note-replies" aria-label="Replies">
            <span className="ost-note-replies-label">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
            {replies.map((r, i) => (
              <div key={i} className="ost-note-reply">
                <i className="ost-note-reply-av" aria-hidden />
                <div className="ost-note-reply-body">
                  <span className="ost-note-reply-name">
                    {r.name} <span className="ost-note-reply-ago">· {r.ago.toUpperCase()}</span>
                  </span>
                  <span className="ost-note-reply-text">{r.text}</span>
                </div>
              </div>
            ))}
            {/* Drawn only: posting replies is not built yet. */}
            <form className="ost-note-form" onSubmit={(e) => e.preventDefault()}>
              <input className="ost-note-input" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" />
              <button type="button" className="ost-note-send" aria-disabled="true">
                Reply
              </button>
            </form>
          </section>
        </article>
      </div>
    </TemplateShell>
  );
}
