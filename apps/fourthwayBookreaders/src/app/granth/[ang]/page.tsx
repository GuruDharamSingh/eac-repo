import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAng, getPaathCircle } from "@/lib/paath";
import { withBase } from "@/lib/base-path";
import { PassageCard, type TextView } from "@/components/paath/passage-card";
import "../../akhand-path/paath.css";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ ang: string }>;
  searchParams: Promise<{ view?: string }>;
}

const VIEWS: Array<[TextView, string]> = [
  ["auto", "Side by side"],
  ["english", "English"],
  ["gurmukhi", "ਗੁਰਮੁਖੀ"],
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ang } = await params;
  return { title: `Ang ${ang} — Sri Guru Granth Sahib` };
}

/** One Ang of the public Granth: the passages on it, Gurmukhi beside English. */
export default async function GranthAng({ params, searchParams }: Props) {
  const { ang } = await params;
  const { view: v } = await searchParams;
  const n = Number(ang);
  if (!Number.isInteger(n) || n < 1 || n > 1430) notFound();
  const view: TextView = v === "english" || v === "gurmukhi" ? v : "auto";
  const circle = await getPaathCircle();
  if (!circle) notFound();
  const passages = await getAng(circle, n);
  const q = view === "auto" ? "" : `?view=${view}`;
  const sections = [...new Set(passages.map((p) => p.section))];

  return (
    <div className="column band paath-page">
      <p className="eyebrow">
        <Link href="/granth">Sri Guru Granth Sahib</Link>
        {sections.length > 0 && <> › {sections.join(" · ")}</>}
      </p>
      <h1 className="paath-title">Ang {n}</h1>

      <nav className="granth-nav" aria-label="Angs">
        {n > 1 ? <Link href={`/granth/${n - 1}${q}`}><ChevronLeft size={14} aria-hidden /> Ang {n - 1}</Link> : <span />}
        <span className="granth-views">
          {VIEWS.map(([key, label]) => (
            <Link key={key} href={`/granth/${n}${key === "auto" ? "" : `?view=${key}`}`} className="paath-chip" aria-pressed={view === key}>
              {label}
            </Link>
          ))}
        </span>
        <form method="get" action={withBase("/granth")}>
          <input name="ang" type="number" min={1} max={1430} inputMode="numeric" aria-label="Go to Ang" placeholder="Ang" />
          <button type="submit" className="btn btn--small">Go</button>
        </form>
        {n < 1430 ? <Link href={`/granth/${n + 1}${q}`}>Ang {n + 1} <ChevronRight size={14} aria-hidden /></Link> : <span />}
      </nav>

      <div className="paath-desk">
        {passages.length === 0 ? (
          <div className="empty">Nothing found on this Ang.</div>
        ) : (
          passages.map((p) => <PassageCard key={p.id} passage={p} view={view} readOnly />)
        )}
      </div>

      <nav className="granth-nav" aria-label="Angs">
        {n > 1 ? <Link href={`/granth/${n - 1}${q}`}><ChevronLeft size={14} aria-hidden /> Ang {n - 1}</Link> : <span />}
        {n < 1430 ? <Link href={`/granth/${n + 1}${q}`}>Ang {n + 1} <ChevronRight size={14} aria-hidden /></Link> : <span />}
      </nav>
      {circle.edition && <p className="paath-fine">Text: {circle.edition}.</p>}
    </div>
  );
}
