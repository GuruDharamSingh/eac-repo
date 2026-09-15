import Link from "next/link";

export const metadata = { title: "Figurative" };

// Her real page had nav only, no body copy or images left in the scrape.
// Honest placeholder rather than invented description — see /art-archive
// and /cv for the real figurative-work exhibition history.
export default function FigurativePage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Figurative</h1>
      <p>
        Figurative work — portraiture, life drawing and figure studies. See the{" "}
        <Link href="/art-archive">Art Archive</Link> and <Link href="/cv">CV</Link> for the exhibition
        history of this collection.
      </p>
    </article>
  );
}
