import { MEDICINE_BUDDHA } from "@/lib/content";

export const metadata = { title: "Medicine Buddha Invocation" };

export default function MedicineBuddhaPage() {
  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Medicine Buddha Invocation</h1>
      <div className="manifesto-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MEDICINE_BUDDHA.image} alt="" className="circle-crop" />
        <div>
          <h2 className="manifesto-heading">{MEDICINE_BUDDHA.subtitle}</h2>
          <p style={{ fontStyle: "italic" }}>{MEDICINE_BUDDHA.caption}</p>
          <p>{MEDICINE_BUDDHA.credit}</p>
          <p>{MEDICINE_BUDDHA.note}</p>
        </div>
      </div>
      {MEDICINE_BUDDHA.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p style={{ marginTop: "1.5rem", fontWeight: 600 }}>Shown at</p>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {MEDICINE_BUDDHA.shown.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </article>
  );
}
