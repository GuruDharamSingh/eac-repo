import {
  CV_MEMBERSHIPS,
  CV_EXHIBITIONS,
  CV_WORKSHOPS_TEACHING,
  CV_WRITING_ORGANIZING,
  CV_PERFORMANCE,
  CV_PUBLICATIONS,
  CV_EDUCATION,
} from "@/lib/content";

export const metadata = { title: "CV" };

function YearGroup({ groups }: { groups: Array<{ year: string; items: string[] }> }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.year}>
          <p className="cv-year">{g.year}</p>
          {g.items.map((item, i) => (
            <p className="cv-entry" key={i}>
              {item}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}

export default function CvPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">CV</h1>
      <p style={{ marginBottom: "0.25rem" }}>Dana McCool</p>
      <p style={{ marginBottom: "0.25rem" }}>Interdisciplinary Artist &amp; Writer, BFA</p>
      <p style={{ marginBottom: "2rem" }}>Educator &amp; Community Organizer</p>

      <section className="cv-section">
        <h2>Collectives / Community Membership</h2>
        {CV_MEMBERSHIPS.map((m, i) => (
          <p className="cv-entry" key={i}>
            <strong>{m.year}</strong> {m.text}
          </p>
        ))}
      </section>

      <section className="cv-section">
        <h2>Exhibitions &amp; Marketplaces</h2>
        <YearGroup groups={CV_EXHIBITIONS} />
      </section>

      <section className="cv-section">
        <h2>Workshops &amp; Teaching</h2>
        <YearGroup groups={CV_WORKSHOPS_TEACHING} />
      </section>

      <section className="cv-section">
        <h2>Writing &amp; Community Organizing</h2>
        <YearGroup groups={CV_WRITING_ORGANIZING} />
      </section>

      <section className="cv-section">
        <h2>Performance</h2>
        <YearGroup groups={CV_PERFORMANCE} />
      </section>

      <section className="cv-section">
        <h2>Publications</h2>
        <YearGroup groups={CV_PUBLICATIONS} />
      </section>

      <section className="cv-section">
        <h2>Education</h2>
        <YearGroup groups={CV_EDUCATION} />
      </section>
    </article>
  );
}
