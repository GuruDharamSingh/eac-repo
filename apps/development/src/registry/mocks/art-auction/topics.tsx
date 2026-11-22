"use client";

import "./auction-mock.css";

// Static copy of Topics' markup (article-blocks.tsx), with the block's own sample rows.
const TOPICS = [
  { id: "t1", title: "How to bid in a silent auction", replies: 12 },
  { id: "t2", title: "Meet the artists", replies: 4 },
  { id: "t3", title: "Shipping and pickup", replies: 1 },
  { id: "t4", title: "Framing and care for works on paper", replies: 7 },
];

export default function TopicsMock() {
  return (
    <section>
      <h2 className="au-h2">From the forum</h2>
      <ul className="au-list">
        {TOPICS.map((t) => (
          <li key={t.id}>
            <a href="#" className="au-topic" onClick={(e) => e.preventDefault()}>
              {t.title}
            </a>
            <span className="au-count">
              {t.replies} {t.replies === 1 ? "reply" : "replies"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
