"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { allThreads } from "./actions";
import { AskBox, ThreadCard, anchorLabel, isAsk, when } from "./ThreadCard";
import { isFail, isOpenStatus, noteHref, type Thread } from "./types";
import "./desk.css";

/** The Desk page body: Justin's notes, Claude's questions, and the latest from Claude. */
export function DeskBoard() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [state, setState] = useState<"ok" | "setup" | "error">("ok");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await allThreads();
    if (!isFail(r)) {
      setThreads(r.threads);
      setState("ok");
    } else {
      setState(r.reason === "setup" ? "setup" : "error");
      setMsg(r.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (state === "setup") return <div className="desk-empty">Notes are not switched on yet.</div>;
  if (state === "error") return <div className="desk-err">{msg}</div>;
  if (!threads) return <div className="desk-empty">Loading</div>;

  const mine = threads.filter((t) => t.authorKind === "person");
  const mineSorted = [...mine.filter((t) => isOpenStatus(t.status)), ...mine.filter((t) => !isOpenStatus(t.status))];
  const asks = threads.filter(isAsk);
  const asksSorted = [...asks.filter((t) => !t.answer), ...asks.filter((t) => t.answer)];
  const updates = threads.filter((t) => t.kind === "update" && t.authorKind === "claude");
  const waiting = asks.filter((t) => !t.answer).length;

  return (
    <>
      <section className="desk-sec">
        <h2>Your notes</h2>
        <p className="desk-muted">
          {mine.filter((t) => isOpenStatus(t.status)).length} open, {mine.filter((t) => !isOpenStatus(t.status)).length} finished. Click a note&apos;s page to jump to the spot.
        </p>
        <div className="desk-list">
          {mineSorted.length ? mineSorted.map((t) => <ThreadCard key={t.id} t={t} showLink onChange={load} />) : <div className="desk-empty">No notes yet. Use the Note for Claude button on any page.</div>}
        </div>
      </section>

      <section className="desk-sec">
        <h2>Questions from Claude</h2>
        <p className="desk-muted">{waiting ? `${waiting} waiting for your answer.` : "Nothing waiting for you."}</p>
        <div className="desk-list">
          {asksSorted.length ? (
            asksSorted.map((t) => (
              <div key={t.id} className={`desk-card${t.answer ? " desk-closed" : " desk-hot"}`}>
                <div className="desk-meta">
                  <span className="desk-kind">{t.kind === "decision" ? "Decision" : "Question"}</span>
                  <span>{when(t.createdAt)}</span>
                </div>
                {t.path !== "/" || t.anchor ? (
                  <Link className="desk-where" href={noteHref(t)}>
                    {t.path}
                    {t.anchor ? ` · ${anchorLabel(t.anchor)}` : ""}
                  </Link>
                ) : null}
                <div className="desk-body">{t.body}</div>
                <AskBox t={t} onChange={load} />
              </div>
            ))
          ) : (
            <div className="desk-empty">No questions.</div>
          )}
        </div>
      </section>

      <section className="desk-sec">
        <h2>Latest from Claude</h2>
        <p className="desk-muted">What changed, newest first.</p>
        <div className="desk-list">
          {updates.length ? (
            updates.map((t) => (
              <div key={t.id} className="desk-card">
                <div className="desk-meta">
                  <span>{when(t.createdAt)}</span>
                  {t.path !== "/" || t.anchor ? (
                    <Link className="desk-where" href={noteHref(t)}>
                      {t.path}
                      {t.anchor ? ` · ${anchorLabel(t.anchor)}` : ""}
                    </Link>
                  ) : null}
                </div>
                <div className="desk-body">{t.body}</div>
              </div>
            ))
          ) : (
            <div className="desk-empty">Nothing posted yet.</div>
          )}
        </div>
      </section>
    </>
  );
}
