import { BOTANICAL_RESIN } from "@/lib/content";

export const metadata = { title: "Botanical Resin Sculptures" };

export default function BotanicalResinPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Botanical Resin Sculptures</h1>
      <p style={{ fontWeight: 600 }}>{BOTANICAL_RESIN.subtitle}</p>
      {BOTANICAL_RESIN.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {BOTANICAL_RESIN.pieces.map((piece, i) => (
        <div key={i} style={{ marginTop: "1.5rem" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.15rem" }}>“{piece.title}”</p>
          <p>{piece.detail}</p>
        </div>
      ))}
    </article>
  );
}
