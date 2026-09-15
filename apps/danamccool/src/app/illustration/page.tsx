import Link from "next/link";

export const metadata = { title: "Illustration" };

export default function IllustrationPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Illustration</h1>
      <p>
        Illustration work, 2012–2013: self-portraiture and gender studies. See the{" "}
        <Link href="/art-archive">Art Archive</Link> for the individual pieces.
      </p>
    </article>
  );
}
