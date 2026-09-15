import { PORTRAITURE_2016 } from "@/lib/content";

export const metadata = { title: "Chroma Portraiture 2016" };

export default function PortraiturePage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Chroma Portraiture 2016</h1>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {PORTRAITURE_2016.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>
    </article>
  );
}
