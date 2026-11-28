"use client";

import Link from "next/link";
import { useState } from "react";
import { answerQuestion, markNote, replyNote } from "./actions";
import { isFail, isOpenStatus, noteHref, STATUS_LABEL, type Note, type Thread } from "./types";
import "./desk.css";

export const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const anchorLabel = (a: string | null) => (!a ? "" : a.startsWith("css:") ? "a spot on the page" : a);
const KIND_LABEL: Record<string, string> = { note: "Note", question: "Question", change: "Change", bug: "Bug", idea: "Idea", update: "Update", decision: "Decision" };

/** True for a question Claude is asking Justin (as opposed to his own "Question" note). */
export const isAsk = (t: Note) => t.authorKind === "claude" && (t.kind === "decision" || t.kind === "question");

function Reply({ r }: { r: Note }) {
  return (
    <div className={`desk-reply${r.authorKind === "claude" ? " desk-claude" : ""}`}>
      <div className="desk-who">
        {r.authorKind === "claude" ? "Claude" : "You"} · {when(r.createdAt)}
      </div>
      <div className="desk-body">{r.body}</div>
    </div>
  );
}

/** The answer buttons and free field of a question from Claude. */
export function AskBox({ t, onChange }: { t: Thread; onChange: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(a: string) {
    setBusy(true);
    setErr("");
    const r = await answerQuestion(t.id, a);
    setBusy(false);
    if (isFail(r)) return setErr(r.message);
    onChange();
  }
  if (t.answer) return <div className="desk-reply">Your answer: <b>{t.answer}</b></div>;
  return (
    <div className="desk-list">
      {t.options ? (
        <div className="desk-row">
          {t.options.map((o) => (
            <button key={o} className="desk-b" disabled={busy} onClick={() => send(o)}>
              {o}
            </button>
          ))}
        </div>
      ) : null}
      <div className="desk-row" style={{ flexWrap: "nowrap" }}>
        <input className="desk-t" value={text} maxLength={4000} placeholder={t.options ? "Or answer in your own words" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && send(text)} />
        <button className="desk-b desk-go" disabled={busy || !text.trim()} onClick={() => send(text)}>
          Answer
        </button>
      </div>
      {err ? <div className="desk-err">{err}</div> : null}
    </div>
  );
}

/** One note with its replies, a reply box and the done / reopen buttons. */
export function ThreadCard({ t, onChange, showLink, hot, pinNo }: { t: Thread; onChange: () => void; showLink?: boolean; hot?: boolean; pinNo?: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = isOpenStatus(t.status);
  async function run(p: Promise<{ ok: boolean }>) {
    setBusy(true);
    setErr("");
    const r = await p;
    setBusy(false);
    if (isFail(r)) return setErr(r.message);
    setText("");
    onChange();
  }
  return (
    <div className={`desk-card${hot ? " desk-hot" : ""}${open ? "" : " desk-closed"}`} id={`desk-note-${t.id}`}>
      <div className="desk-meta">
        {pinNo ? <span className="desk-kind">{pinNo}</span> : null}
        <span className="desk-kind">{KIND_LABEL[t.kind] ?? t.kind}</span>
        <span>{t.authorKind === "claude" ? "From Claude" : STATUS_LABEL[t.status]}</span>
        <span>{when(t.createdAt)}</span>
      </div>
      {showLink ? (
        <Link className="desk-where" href={noteHref(t)}>
          {t.path}
          {t.anchor ? ` · ${anchorLabel(t.anchor)}` : ""}
        </Link>
      ) : null}
      {t.anchorText ? <div className="desk-snip">&ldquo;{t.anchorText}&rdquo;</div> : null}
      <div className="desk-body">{t.body}</div>
      {isAsk(t) ? <AskBox t={t} onChange={onChange} /> : null}
      {t.replies.map((r) => (
        <Reply key={r.id} r={r} />
      ))}
      <div className="desk-row" style={{ flexWrap: "nowrap" }}>
        <input className="desk-t" value={text} maxLength={4000} placeholder="Reply" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && run(replyNote(t.id, text))} />
        <button className="desk-b" disabled={busy || !text.trim()} onClick={() => run(replyNote(t.id, text))}>
          Send
        </button>
      </div>
      <div className="desk-row">
        {open ? (
          <>
            <button className="desk-b" disabled={busy} onClick={() => run(markNote(t.id, "done"))}>
              Mark done
            </button>
            <button className="desk-b" disabled={busy} onClick={() => run(markNote(t.id, "wontdo"))}>
              Will not do
            </button>
          </>
        ) : (
          <button className="desk-b" disabled={busy} onClick={() => run(markNote(t.id, "open"))}>
            Open again
          </button>
        )}
      </div>
      {err ? <div className="desk-err">{err}</div> : null}
    </div>
  );
}
