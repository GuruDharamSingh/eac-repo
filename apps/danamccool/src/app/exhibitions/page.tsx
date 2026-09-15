import Link from "next/link";
import { PAST_EXHIBITIONS_NOTE, PAST_EXHIBITIONS_HIGHLIGHTS } from "@/lib/content";

export const metadata = { title: "Past Exhibitions" };

export default function PastExhibitionsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Past Exhibitions</h1>
      <p>{PAST_EXHIBITIONS_NOTE}</p>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {PAST_EXHIBITIONS_HIGHLIGHTS.map((item, i) => (
          <li key={i} style={{ marginBottom: "0.5rem" }}>
            {item}
          </li>
        ))}
      </ul>
      <p style={{ marginTop: "1.5rem" }}>
        The complete, year-by-year exhibition history is on the <Link href="/cv">CV</Link> page.
      </p>
    </article>
  );
}
