import { WORKSHOPS_INTRO, WORKSHOPS_PAST, WORKSHOPS_OTHER } from "@/lib/content";

export const metadata = { title: "Workshops & Teaching" };

export default function WorkshopsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Workshops &amp; Teaching</h1>
      <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Current</h2>
      <p>Ongoing: independent course offerings. {WORKSHOPS_INTRO}</p>

      <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2rem" }}>
        Past Sessions / Archive
      </h2>
      {WORKSHOPS_PAST.map((w, i) => (
        <div key={i} style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{w.title}</p>
          <p>{w.detail}</p>
        </div>
      ))}

      <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2rem" }}>
        Other Past Workshops &amp; Engagements
      </h2>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {WORKSHOPS_OTHER.map((item, i) => (
          <li key={i} style={{ marginBottom: "0.5rem" }}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
