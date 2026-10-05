import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getViewer } from "@/lib/auth";
import {
  dayNumber,
  dayOf,
  fileCallRecordings,
  getDayNote,
  getOtherNotesOfDay,
  getPaathReader,
  getPassagesOfDay,
  getRecordings,
  isDay,
  neighbourDay,
} from "@/lib/paath";
import { PassageCard } from "@/components/paath/passage-card";
import { DayNote } from "@/components/paath/day-note";
import "../../paath.css";

export const metadata: Metadata = { title: "Akhand Path — a day", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ date: string }>;
}

const longDay = (day: string) =>
  new Intl.DateTimeFormat("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";
const size = (bytes: number) => (bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function AkhandPathDay({ params }: Props) {
  const { date } = await params;
  const access = await getPaathReader();
  if (!access) {
    const viewer = await getViewer().catch(() => null);
    if (!viewer) redirect(`/login?next=${encodeURIComponent(`/akhand-path/day/${date}`)}`);
    notFound();
  }
  if (!isDay(date)) notFound();
  const { circle, viewer } = access;
  const today = dayOf();
  if (date === today) await fileCallRecordings(circle).catch(() => 0);

  const [passages, recordings, note] = await Promise.all([
    getPassagesOfDay(circle, viewer.userId, date),
    getRecordings(circle, date),
    getDayNote(circle, date),
  ]);
  const elsewhere = await getOtherNotesOfDay(circle, date, passages.map((p) => p.id));
  const n = dayNumber(circle, date);
  const angFrom = passages.length ? Math.min(...passages.map((p) => p.ang)) : null;
  const angTo = passages.length ? Math.max(...passages.map((p) => p.angEnd)) : null;
  const readers = [...new Set(passages.map((p) => p.doneBy).filter(Boolean))];
  const thoughts = passages.reduce((s, p) => s + p.notes.length, 0) + elsewhere.length;

  return (
    <div className="column band paath-page">
      <p className="eyebrow">
        <Link href="/akhand-path">← Akhand Path</Link>
      </p>
      <h1 className="paath-title">{n >= 1 ? `Day ${n}` : "Before the first day"}</h1>
      <p className="paath-sub">{longDay(date)}</p>

      <nav className="paath-daynav" aria-label="Other days">
        <Link href={`/akhand-path/day/${neighbourDay(date, -1)}`}><ChevronLeft size={14} aria-hidden /> The day before</Link>
        {date < today && <Link href={`/akhand-path/day/${neighbourDay(date, 1)}`}>The day after <ChevronRight size={14} aria-hidden /></Link>}
      </nav>

      <section className="paath-summary">
        <div><strong>{passages.length}</strong><span>passage{passages.length === 1 ? "" : "s"} read</span></div>
        <div><strong>{angFrom ? (angTo && angTo !== angFrom ? `${angFrom}–${angTo}` : angFrom) : "—"}</strong><span>Ang</span></div>
        <div><strong>{passages.length ? `${time(passages[0].doneAt)}–${time(passages.at(-1)!.doneAt)}` : "—"}</strong><span>first and last check</span></div>
        <div><strong>{recordings.length}</strong><span>recording{recordings.length === 1 ? "" : "s"}</span></div>
        <div><strong>{thoughts}</strong><span>thought{thoughts === 1 ? "" : "s"}</span></div>
      </section>
      {passages.length > 0 && (() => {
        const sections = [...new Set(passages.map((p) => p.section))];
        const works = [...new Set(passages.map((p) => p.vaar ?? p.subsection).filter((x): x is string => Boolean(x)))];
        const tally = new Map<string, number>();
        for (const p of passages) for (const a of p.authors) tally.set(a, (tally.get(a) ?? 0) + 1);
        return (
          <div className="paath-dayparts">
            <p><span className="paath-dim">From</span> {sections.join(" · ")}</p>
            {works.length > 0 && <p><span className="paath-dim">Including</span> {works.join(" · ")}</p>}
            <p><span className="paath-dim">Bani of</span> {[...tally].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(", ")}</p>
          </div>
        );
      })()}
      {readers.length > 0 && <p className="paath-fine">Read by {readers.join(" and ")}.</p>}

      <section className="paath-section">
        <h2 className="band__title">Recordings</h2>
        {recordings.length === 0 ? (
          <div className="empty">No recording for this day.</div>
        ) : (
          <ul className="paath-recordings">
            {recordings.map((r) => (
              <li key={r.href}>
                <span>{r.name}</span> <span className="paath-dim">{size(r.size)}</span>
                <audio controls preload="none" src={r.href} />
                <a className="paath-link" href={r.href} download>Download</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="paath-section">
        <h2 className="band__title">The day&rsquo;s note</h2>
        <DayNote day={date} initial={note} />
      </section>

      <section className="paath-section">
        <h2 className="band__title">What was read</h2>
        {passages.length === 0 ? (
          <div className="empty">No passages were checked off on this day.</div>
        ) : (
          <div className="paath-desk">
            {passages.map((p) => <PassageCard key={p.id} passage={p} view="both" />)}
          </div>
        )}
      </section>

      {elsewhere.length > 0 && (
        <section className="paath-section">
          <h2 className="band__title">Thoughts left on other passages</h2>
          {elsewhere.map((x) => (
            <div key={x.id} className="paath-note">
              <p className="paath-note__who">{x.author} · {time(x.at)} · {x.passage}</p>
              <p className="paath-note__body">{x.body}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
