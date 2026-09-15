import { COLLAGE_NOTE } from "@/lib/content";

export const metadata = { title: "Collage" };

export default function CollagePage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Collage</h1>
      <p>{COLLAGE_NOTE}</p>
    </article>
  );
}
