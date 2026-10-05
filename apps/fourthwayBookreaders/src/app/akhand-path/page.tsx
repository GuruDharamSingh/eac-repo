import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getViewer } from "@/lib/auth";
import {
  dayNumber,
  dayOf,
  fileCallRecordings,
  getCallState,
  getDayNote,
  getDays,
  getPaathReader,
  getPassagesOfDay,
  getProgress,
  getRecentlyRead,
  getRecordings,
  getUnread,
  neighbourDay,
  type PaathDay,
} from "@/lib/paath";
import { PaathReader } from "@/components/paath/paath-reader";
import { DayNote } from "@/components/paath/day-note";
import { AdminDetails } from "@/components/paath/admin-details";
import { connectionRedirectUri } from "@elkdonis/services";
import "./paath.css";

export const metadata: Metadata = { title: "Akhand Path", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const longDay = (day: string) =>
  new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const shortTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";

export default async function AkhandPathPage() {
  const access = await getPaathReader();
  if (!access) {
    // Private: a stranger learns nothing, not even that it exists.
    const viewer = await getViewer().catch(() => null);
    if (!viewer) redirect(`/login?next=${encodeURIComponent("/akhand-path")}`);
    notFound();
  }
  const { circle, viewer } = access;
  const today = dayOf();
  await fileCallRecordings(circle).catch(() => 0);

  const [passages, readToday, progress, recordings, call, days, dayNote, recent] = await Promise.all([
    getUnread(circle, viewer.userId, 4),
    getPassagesOfDay(circle, viewer.userId, today),
    getProgress(circle),
    getRecordings(circle, today),
    getCallState(circle),
    getDays(circle),
    getDayNote(circle, today),
    getRecentlyRead(circle, 10),
  ]);

  // The last four weeks, oldest first: which days had a reading.
  const byDay = new Map(days.map((d) => [d.day, d]));
  const strip = Array.from({ length: 28 }, (_, i) => neighbourDay(today, i - 27)).filter((d) => d >= neighbourDay(circle.startedOn, -6));
  const readDays = days.filter((d) => d.passages > 0);
  const streak = (() => {
    let n = 0;
    for (let d = byDay.get(today)?.passages ? today : neighbourDay(today, -1); byDay.get(d)?.passages; d = neighbourDay(d, -1)) n++;
    return n;
  })();
  const perDay = readDays.length ? Math.round(readDays.reduce((s, d) => s + d.passages, 0) / readDays.length) : null;
  const daysLeft = perDay && progress.total > progress.done ? Math.ceil((progress.total - progress.done) / perDay) : null;

  return (
    <div className="column band paath-page">
      <p className="eyebrow">
        Akhand Path{circle.isPrivate && <span className="paath-private"><Lock size={11} aria-hidden /> private</span>}
      </p>
      <h1 className="paath-title">
        Sri Guru Granth Sahib <span lang="pa" className="paath-title__g">ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ</span>
      </h1>
      <p className="paath-sub">
        Day {dayNumber(circle, today)} · {longDay(today)}
        {streak > 1 ? ` · ${streak} days running` : ""}
        {daysLeft ? ` · about ${daysLeft} more day${daysLeft === 1 ? "" : "s"} at ${perDay} passages a day` : ""}
      </p>

      <PaathReader
        initialPassages={passages}
        initialToday={[...readToday].reverse()}
        initialProgress={progress}
        initialRecordings={recordings}
        initialCall={call}
        initialRecent={recent}
        talkUrl={circle.talkUrl}
        dayLabel={`Today · Day ${dayNumber(circle, today)}`}
      />

      <section className="paath-section">
        <h2 className="band__title">Today&rsquo;s note</h2>
        <DayNote day={today} initial={dayNote} />
        <p className="paath-fine">
          <Link href={`/akhand-path/day/${today}`}>Open today&rsquo;s entry</Link> — everything read, said and recorded today.
        </p>
      </section>

      <section className="paath-section">
        <h2 className="band__title">The days</h2>
        <div className="paath-strip" aria-label="The last four weeks">
          {strip.map((d) => {
            const x = byDay.get(d);
            const level = !x?.passages ? 0 : x.passages < 5 ? 1 : x.passages < 15 ? 2 : 3;
            return (
              <Link
                key={d}
                href={`/akhand-path/day/${d}`}
                className="paath-strip__day"
                data-level={level}
                data-today={d === today}
                title={`${longDay(d)}: ${x?.passages ?? 0} passages${x?.recordings ? `, ${x.recordings} recording${x.recordings === 1 ? "" : "s"}` : ""}`}
              >
                {Number(d.slice(8))}
              </Link>
            );
          })}
        </div>
        {days.length === 0 ? (
          <div className="empty">The first day&rsquo;s entry appears here once a passage is read.</div>
        ) : (
          <ol className="paath-days">
            {days.map((d: PaathDay) => (
              <li key={d.day}>
                <Link href={`/akhand-path/day/${d.day}`} className="paath-days__row">
                  <span className="paath-days__n">Day {d.number}</span>
                  <span className="paath-days__date">{longDay(d.day)}</span>
                  <span className="paath-days__what">
                    {d.passages ? `${d.passages} passage${d.passages === 1 ? "" : "s"} · Ang ${d.angFrom}${d.angTo && d.angTo !== d.angFrom ? `–${d.angTo}` : ""}` : "no passages"}
                    {d.firstAt ? ` · ${shortTime(d.firstAt)}–${shortTime(d.lastAt)}` : ""}
                  </span>
                  {d.sections.length > 0 && (
                    <span className="paath-days__summary">
                      <span className="paath-days__sections">{d.sections.join(" · ")}</span>
                      {d.works.length > 0 && <span className="paath-days__works">{d.works.slice(0, 4).join(" · ")}{d.works.length > 4 ? ` and ${d.works.length - 4} more` : ""}</span>}
                      <span className="paath-days__authors">{d.authors.map((a) => `${a.name} (${a.passages})`).join(", ")}</span>
                    </span>
                  )}
                  <span className="paath-days__extras">
                    {d.recordings ? `${d.recordings} recording${d.recordings === 1 ? "" : "s"}` : ""}
                    {d.notes ? `${d.recordings ? " · " : ""}${d.notes} thought${d.notes === 1 ? "" : "s"}` : ""}
                    {d.hasNote ? `${d.recordings || d.notes ? " · " : ""}note` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {circle.edition && <p className="paath-fine">Text: {circle.edition}. The whole text is open to visitors at <Link href="/granth">/granth</Link>; the reading itself stays private.</p>}

      {/* Publishing and connections: the circle's author and org owners/guides. */}
      {(viewer.userId === circle.authorId || viewer.canEdit) && (
        <AdminDetails startUrl={connectionRedirectUri().replace(/\/callback$/, "/start")} />
      )}
    </div>
  );
}
