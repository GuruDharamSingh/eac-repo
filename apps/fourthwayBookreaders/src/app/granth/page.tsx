import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGranthIndex, getPaathCircle, type GranthSection } from "@/lib/paath";
import "../akhand-path/paath.css";

export const metadata: Metadata = {
  title: "Sri Guru Granth Sahib",
  description: "The whole Sri Guru Granth Sahib, Ang by Ang, in Gurmukhi with an English translation.",
};
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ ang?: string }>;
}

const KINDS: Array<[string, string]> = [
  ["opening", "The opening banis"],
  ["raag", "The raags"],
  ["closing", "The closing banis"],
];

/**
 * The public Granth: anyone may read the whole text, Ang by Ang. It reads the
 * Akhand Path's passages (src/lib/paath.ts) but nothing of the private reading.
 */
export default async function GranthIndex({ searchParams }: Props) {
  const { ang } = await searchParams;
  const n = Number(ang);
  if (Number.isInteger(n) && n >= 1 && n <= 1430) redirect(`/granth/${n}`);

  const circle = await getPaathCircle();
  if (!circle) notFound();
  const sections = await getGranthIndex(circle);
  const byKind = (k: string) => sections.filter((s: GranthSection) => s.kind === k);

  return (
    <div className="column band paath-page">
      <p className="eyebrow">Read online</p>
      <h1 className="paath-title">
        Sri Guru Granth Sahib <span lang="pa" className="paath-title__g">ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ</span>
      </h1>
      <p className="paath-sub">1430 Angs, in Gurmukhi with an English translation. Begin at the beginning, or open any bani or raag.</p>

      <nav className="granth-nav">
        <Link href="/granth/1" className="btn btn--primary">Begin at Ang 1</Link>
        <form method="get" action="">
          <label htmlFor="granth-ang" className="paath-dim">Go to Ang</label>
          <input id="granth-ang" name="ang" type="number" min={1} max={1430} inputMode="numeric" />
          <button type="submit" className="btn">Go</button>
        </form>
      </nav>

      <div className="granth-index">
        {KINDS.map(([kind, title]) => (
          <section key={kind}>
            <h2 className="band__title">{title}</h2>
            <ol>
              {byKind(kind).map((s) => (
                <li key={s.name}>
                  <Link href={`/granth/${s.angFrom}`}>
                    <span>{s.name}</span>
                    {s.gurmukhi && <span className="granth-index__g" lang="pa">{s.gurmukhi}</span>}
                    <span className="granth-index__angs">Ang {s.angFrom}{s.angTo !== s.angFrom ? `–${s.angTo}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {circle.edition && <p className="paath-fine">Text: {circle.edition}.</p>}
    </div>
  );
}
