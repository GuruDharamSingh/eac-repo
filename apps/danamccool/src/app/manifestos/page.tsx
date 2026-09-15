import { MANIFESTO_2018, MANIFESTO_2013 } from "@/lib/content";

export const metadata = { title: "Manifestos" };

/**
 * Left-aligned, image-beside-text — her real Manifestos layout
 * (danascreenshots/*MANIFESTOS*.png), with circular crops of real artwork
 * standing in for the two portrait-style images on her original page.
 */
export default function ManifestosPage() {
  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Manifestos</h1>

      <section className="manifesto-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MANIFESTO_2018.image} alt="" className="circle-crop" />
        <div>
          <h2 className="manifesto-heading">Manifesto ({MANIFESTO_2018.year})</h2>
          <p>{MANIFESTO_2018.intro}</p>
        </div>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        {MANIFESTO_2018.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p style={{ fontStyle: "italic" }}>{MANIFESTO_2018.credit}</p>
      </section>

      <section className="manifesto-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MANIFESTO_2013.image} alt="" className="circle-crop" />
        <div>
          <h2 className="manifesto-heading">Manifesto ({MANIFESTO_2013.year})</h2>
          {MANIFESTO_2013.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>
    </article>
  );
}
