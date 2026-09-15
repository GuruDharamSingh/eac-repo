import { PUBLICATIONS_LIST } from "@/lib/content";

export const metadata = { title: "Publications" };

export default function PublicationsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Publications</h1>
      {PUBLICATIONS_LIST.map((p, i) => (
        <p key={i}>
          <strong>{p.year}</strong> — {p.text}
        </p>
      ))}
    </article>
  );
}
