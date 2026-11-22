"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { decideExperienceAction } from "@/lib/artist-wizard-actions";
import "./board.css";

// "To review" on the Office home (owners only): each experience an artist sent in, with the three decisions from the
// pack (screens-board.md §1): Publish, Members only, Send back with notes. Send back opens a notes field first.

export interface ReviewCard {
  id: string;
  title: string;
  pitch: string | null;
  artistName: string | null;
  /** "In person · 90 min · EUR 90 per run" or similar, built on the server. */
  details: string;
}

export function OfficeReviewCards({ cards }: { cards: ReviewCard[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [backFor, setBackFor] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function decide(id: string, decision: "publish" | "members" | "send_back") {
    setError(null);
    start(async () => {
      const r = await decideExperienceAction(id, decision, decision === "send_back" ? notes : undefined);
      if (r.ok === false) { setError(r.error); return; }
      toast(decision === "publish" ? "Published." : decision === "members" ? "Published for members." : "Sent back with your notes.");
      setBackFor(null);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="b-review-list">
      {cards.map((c) => (
        <article key={c.id} className="b-review">
          <span className="m-kicker b-review-by">{c.artistName ? `${c.artistName} · new experience` : "New experience"}</span>
          <h3 className="b-review-title">{c.title}</h3>
          {c.pitch ? <p className="b-review-pitch">{c.pitch}</p> : null}
          <p className="b-review-details">{c.details}</p>
          <Link href={`/manage/experiences/${c.id}`} className="b-sr-link b-review-open">Read the whole draft</Link>
          {backFor === c.id ? (
            <div className="b-review-notes">
              <label className="b-review-notes-label" htmlFor={`rn-${c.id}`}>What should the artist change?</label>
              <textarea id={`rn-${c.id}`} className="b-reason b-review-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="b-confirm-row">
                <button type="button" className="b-act" disabled={pending} onClick={() => { setBackFor(null); setNotes(""); setError(null); }}>Cancel</button>
                <button type="button" className="b-act b-act-danger" disabled={pending || !notes.trim()} onClick={() => decide(c.id, "send_back")}>Send back</button>
              </div>
            </div>
          ) : (
            <div className="b-review-acts">
              <button type="button" className="b-review-primary" disabled={pending} onClick={() => decide(c.id, "publish")}>Publish</button>
              <button type="button" className="b-act b-review-sec" disabled={pending} onClick={() => decide(c.id, "members")}>Members only</button>
              <button type="button" className="b-act b-review-sec" disabled={pending} onClick={() => { setBackFor(c.id); setError(null); }}>Send back</button>
            </div>
          )}
        </article>
      ))}
      {error ? <p className="b-err" role="alert">{error}</p> : null}
    </div>
  );
}
