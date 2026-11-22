"use client";

import "./auction-mock.css";

// Static copy of discussion.client.tsx's markup (the live block polls /api/auction/discussion).
const REPLIES = [
  { id: "r1", name: "A member", ago: "4 min ago", text: "The colour in the second lot is remarkable." },
  { id: "r2", name: "Another member", ago: "31 min ago", text: "Does anyone know how it was framed?" },
  { id: "r3", name: "A third member", ago: "2 h ago", text: "Thank you for the shipping notes, they were clear." },
];

export default function DiscussionMock() {
  return (
    <section aria-label="Discussion">
      <div className="au-head">
        <h2 className="au-h2">
          Discussion <span className="au-replies-n">{REPLIES.length} replies</span>
        </h2>
        <a href="#" className="au-join" onClick={(e) => e.preventDefault()}>
          Join the discussion
        </a>
      </div>
      <ol className="au-replies">
        {REPLIES.map((r) => (
          <li key={r.id} className="au-reply">
            <div className="au-reply-meta">
              <b>{r.name}</b>
              <time>{r.ago}</time>
            </div>
            <p>{r.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
