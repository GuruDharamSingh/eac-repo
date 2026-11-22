import { BandHead } from "./parts";

const TOPICS = [
  { t: "How do wings change a reading?", m: "12 replies · 2 days ago" },
  { t: "A question about the hidden triads", m: "5 replies · 4 days ago" },
  { t: "Word of the week: fixation", m: "Dictionary · last week" },
  { t: "Sharing a practice for the heart center", m: "8 replies · last week" },
];

export default function Mock() {
  return (
    <section className="blk he-forum">
      <BandHead eyebrow="Forum" title="From the forum" />
      <ul className="he-forum-list">
        {TOPICS.map((x) => (
          <li key={x.t}>
            <a href="#mock">
              <span className="he-forum-title">{x.t}</span>
              <span className="he-forum-meta">{x.m}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="he-band-more">
        <a href="#mock">Enter the forum →</a>
      </p>
    </section>
  );
}
