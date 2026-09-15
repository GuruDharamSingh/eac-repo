import { ART_ARCHIVE } from "@/lib/content";

export const metadata = { title: "Art Archive" };

export default function ArtArchivePage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Art Archive</h1>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {ART_ARCHIVE.map((item, i) => (
          <li key={i} style={{ marginBottom: "0.5rem" }}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
