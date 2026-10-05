import {
  getCourseBySlug, getRealms, listCatalogue, listEditableCourses, listGuides, listHubWorkshops, listMyEnrolments, listOfferings,
  listTraditions, onSide, scheduleBetween, type Course, type Guide, type Offering, type Realm,
} from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import type { PageQuery } from "./pages";
import { Flash, SIDES, fmtDate } from "./parts";
import { WorkshopCards } from "./workshops";

const TZ = "America/Toronto";


// ── time: weeks run Monday to Sunday, in Toronto ─────────────────────────────
/** Toronto's offset from UTC at an instant, in ms. */
function tzOffsetMs(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime();
}
/** Midnight in Toronto on a calendar day. */
function torontoMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
/** The seven days of the week containing `week` (any YYYY-MM-DD; default today). */
function weekDays(week?: string): Array<{ key: string; start: Date; end: Date }> {
  const base = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : ymd(new Date());
  const [y, m, d] = base.split("-").map(Number);
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d - back + i));
    const next = new Date(Date.UTC(y, m - 1, d - back + i + 1));
    return {
      key: day.toISOString().slice(0, 10),
      start: torontoMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()),
      end: torontoMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
    };
  });
}
const shiftWeek = (key: string, weeks: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10);
};
const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: TZ });

const offeringHref = (c: LmsConnectors, o: Offering) => c.offeringUrl?.(o) ?? c.hrefs.forumThread(o.id, o.slug);
const formatWords: Record<string, string> = { online: "Online", in_person: "In person", hybrid: "Online and in person" };

// ── shared pieces ─────────────────────────────────────────────────────────────
/** Every published course this viewer can open: the public catalogue, the ones they're in, the ones they teach. */
async function openCourses(viewer: Awaited<ReturnType<LmsConnectors["viewer"]>>): Promise<Course[]> {
  const [open, mine, taught] = await Promise.all([
    listCatalogue(),
    viewer.userId ? listMyEnrolments(viewer.userId) : Promise.resolve([]),
    viewer.userId ? listEditableCourses(viewer).catch(() => []) : Promise.resolve([]),
  ]);
  const seen = new Map<string, Course>();
  for (const k of [...open, ...taught]) if (k.publishedVersionId && !seen.has(k.slug)) seen.set(k.slug, k);
  for (const e of mine) {
    if (seen.has(e.courseSlug)) continue;
    const k = await getCourseBySlug(e.courseSlug);
    if (k?.publishedVersionId) seen.set(k.slug, k);
  }
  return [...seen.values()];
}

function CourseCards({ c, items }: { c: LmsConnectors; items: Course[] }) {
  return (
    <ul className="so-cards">
      {items.map((k) => (
        <li key={k.id} className="so-card">
          <span className="so-kicker">{k.orgName}</span>
          <h3><a href={c.hrefs.course(k.slug)}>{k.title}</a></h3>
          {k.summary && <p>{k.summary}</p>}
        </li>
      ))}
    </ul>
  );
}

function GuideCards({ c, items }: { c: LmsConnectors; items: Guide[] }) {
  return (
    <ul className="so-guides">
      {items.map((g) => (
        <li key={g.userId} id={g.slug ? `g-${g.slug}` : undefined} className="so-guidecard">
          {g.photoUrl ? <img src={c.mediaUrl(g.photoUrl)} alt="" /> : <span className="so-guidecard__initial" aria-hidden>{g.name.slice(0, 1)}</span>}
          <div>
            <span className="so-kicker">{g.realm ? SIDES[g.realm].kicker : "Inner and outer"}</span>
            <h3>{g.name}</h3>
            {g.traditions.length > 0 && (
              <p className="so-guidecard__trads">
                {g.traditions.map((t, i) => <span key={t.id}>{i > 0 && " · "}<a href={`${c.hrefs.traditions()}#t-${t.slug}`}>{t.name}</a></span>)}
              </p>
            )}
            {g.bio && <p>{g.bio}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function WeekList({ c, days, items }: { c: LmsConnectors; days: ReturnType<typeof weekDays>; items: Array<{ offering: Offering; at: Date }> }) {
  const today = ymd(new Date());
  return (
    <ol className="so-week">
      {days.map((d) => {
        const on = items.filter((x) => ymd(x.at) === d.key);
        return (
          <li key={d.key} data-today={d.key === today || undefined}>
            <h3>{dayLabel(d.key)}{d.key === today && <span className="so-here">Today</span>}</h3>
            {on.length === 0 ? <p className="so-meta">—</p> : (
              <ul>
                {on.map(({ offering: o, at }) => (
                  <li key={`${o.id}-${at.toISOString()}`}>
                    <time dateTime={at.toISOString()}>{timeLabel(at)}</time>
                    <div>
                      <a href={offeringHref(c, o)}>{o.title}</a>
                      <span className="so-meta">
                        {[o.leader && `with ${o.leader}`, o.durationMinutes && `${o.durationMinutes} min`, o.format && formatWords[o.format], o.location].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── / : Inner or Outer ────────────────────────────────────────────────────────
export async function HomePage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<React.ReactNode> {
  const viewer = await c.viewer();
  const mine = viewer.userId ? (await listMyEnrolments(viewer.userId)).filter((e) => e.status !== "withdrawn") : [];
  return (
    <main className="so-page">
      <Flash {...q} />
      <h1 className="so-sr">{c.site.name}</h1>
      <nav className="so-doors" aria-label="Inner or outer">
        {(["inner", "outer"] as const).map((r) => (
          <a key={r} className="so-door" data-side={r} href={c.hrefs.side(r)}>
            <span className="so-kicker">{SIDES[r].kicker}</span>
            <strong>{SIDES[r].title}</strong>
            <span>{SIDES[r].blurb}</span>
            <span className="so-door__go">Enter →</span>
          </a>
        ))}
      </nav>
      {mine.length > 0 && (
        <section aria-labelledby="yours-h">
          <h2 id="yours-h" className="so-h2">Where you are</h2>
          <ul className="so-cards">
            {mine.map((e) => (
              <li key={e.id} className="so-card">
                <h3><a href={c.hrefs.course(e.courseSlug)}>{e.courseTitle}</a></h3>
                <p className="so-meta">{e.status === "completed" ? `Finished ${fmtDate(e.completedAt!)}` : `Begun ${fmtDate(e.enrolledAt)}`}</p>
                <a className="so-btn" href={c.hrefs.course(e.courseSlug)}>{e.status === "completed" ? "Return" : "Continue"}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="so-hublinks">
        <a href={c.hrefs.courses()}>All courses</a> · <a href={c.hrefs.workshops()}>Workshops</a> · <a href={c.hrefs.schedule()}>This week’s schedule</a> · <a href={c.hrefs.guides()}>Guides</a> · <a href={c.hrefs.traditions()}>Traditions</a>
      </p>
    </main>
  );
}

// ── /inner, /outer ──────────────────────────────────────────────────────────
export async function SidePage({ c, q, side }: { c: LmsConnectors; q: PageQuery; side: Realm }): Promise<React.ReactNode> {
  const viewer = await c.viewer();
  const [courses, workshops, guides] = await Promise.all([openCourses(viewer), listHubWorkshops(), listGuides({ listedOnly: true })]);
  const [courseRealms, workshopRealms] = await Promise.all([
    getRealms("course", courses.map((k) => k.id)),
    getRealms("thread", [...workshops.upcoming, ...workshops.previous].map((w) => w.id)),
  ]);
  const here = {
    courses: courses.filter((k) => onSide(courseRealms.get(k.id), side)),
    upcoming: workshops.upcoming.filter((w) => onSide(workshopRealms.get(w.id), side)),
    previous: workshops.previous.filter((w) => onSide(workshopRealms.get(w.id), side)),
    guides: guides.filter((g) => onSide(g.realm, side)),
  };
  const traditions = [...new Map(here.guides.flatMap((g) => g.traditions).map((t) => [t.id, t])).values()];
  const other: Realm = side === "inner" ? "outer" : "inner";

  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">{SIDES[side].kicker}</span>
        <h1>{SIDES[side].title}</h1>
        <p>{SIDES[side].blurb}</p>
        <p className="so-meta"><a href={c.hrefs.side(other)}>Go to {SIDES[other].kicker}: {SIDES[other].title.toLowerCase()} →</a></p>
      </header>

      <section aria-labelledby="co-h">
        <h2 id="co-h" className="so-h2">Courses</h2>
        {here.courses.length === 0 ? <p className="so-empty">No courses here yet.</p> : <CourseCards c={c} items={here.courses} />}
      </section>

      <section aria-labelledby="ws-h">
        <h2 id="ws-h" className="so-h2">Workshops</h2>
        {here.upcoming.length === 0 && here.previous.length === 0 ? <p className="so-empty">No workshops here yet.</p> : (
          <>
            {here.upcoming.length > 0 && <WorkshopCards c={c} items={here.upcoming} />}
            {here.previous.length > 0 && <><h3 className="so-subhead">Previous workshops</h3><WorkshopCards c={c} items={here.previous} past /></>}
          </>
        )}
      </section>

      <section aria-labelledby="gd-h">
        <h2 id="gd-h" className="so-h2">Guides</h2>
        {here.guides.length === 0 ? <p className="so-empty">No guides are listed here yet.</p> : <GuideCards c={c} items={here.guides} />}
        {traditions.length > 0 && (
          <p className="so-meta">Teaching from: {traditions.map((t, i) => <span key={t.id}>{i > 0 && " · "}<a href={`${c.hrefs.traditions()}#t-${t.slug}`}>{t.name}</a></span>)}</p>
        )}
      </section>
    </main>
  );
}

// ── /guides ───────────────────────────────────────────────────────────────────
export async function GuidesPage({ c, q, side }: { c: LmsConnectors; q: PageQuery; side?: Realm | null }): Promise<React.ReactNode> {
  const guides = (await listGuides({ listedOnly: true })).filter((g) => onSide(g.realm, side ?? null));
  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Guides</span>
        <h1>Guides</h1>
        <p>The people who teach and hold gatherings here, and the traditions they teach from.</p>
        <nav className="so-chips" aria-label="Filter guides">
          <a className="so-chip" href={c.hrefs.guides()} aria-current={!side ? "true" : undefined}>All</a>
          <a className="so-chip" href={`${c.hrefs.guides()}?side=inner`} aria-current={side === "inner" ? "true" : undefined}>Inner</a>
          <a className="so-chip" href={`${c.hrefs.guides()}?side=outer`} aria-current={side === "outer" ? "true" : undefined}>Outer</a>
        </nav>
      </header>
      {guides.length === 0 ? <p className="so-empty">No guides are listed yet.</p> : <GuideCards c={c} items={guides} />}
    </main>
  );
}

// ── /traditions ───────────────────────────────────────────────────────────────
export async function TraditionsPage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<React.ReactNode> {
  const [traditions, guides] = await Promise.all([listTraditions(), listGuides({ listedOnly: true })]);
  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Traditions</span>
        <h1>Traditions</h1>
        <p>The traditions our guides teach from.</p>
      </header>
      {traditions.length === 0 ? <p className="so-empty">No traditions are listed yet.</p> : traditions.map((t) => {
        const teaching = guides.filter((g) => g.traditions.some((x) => x.id === t.id));
        return (
          <section key={t.id} id={`t-${t.slug}`} className="so-tradition" aria-labelledby={`th-${t.slug}`}>
            <h2 id={`th-${t.slug}`} className="so-bycourse__h">{t.name}</h2>
            {t.description && <p className="so-tradition__desc">{t.description}</p>}
            <p className="so-meta">
              {teaching.length === 0 ? "No guide is listed for this tradition yet." : <>Taught by {teaching.map((g, i) => <span key={g.userId}>{i > 0 && (i === teaching.length - 1 ? " and " : ", ")}<a href={`${c.hrefs.guides()}${g.slug ? `#g-${g.slug}` : ""}`}>{g.name}</a></span>)}</>}
            </p>
          </section>
        );
      })}
    </main>
  );
}

// ── /schedule ─────────────────────────────────────────────────────────────────
export async function SchedulePage({ c, q, week, side }: { c: LmsConnectors; q: PageQuery; week?: string; side?: Realm | null }): Promise<React.ReactNode> {
  const days = weekDays(week);
  const offerings = c.offerings ? await listOfferings(c.offerings) : [];
  const items = scheduleBetween(offerings.filter((o) => onSide(o.realm, side ?? null)), days[0].start, days[6].end);
  const monday = days[0].key;
  const sideQ = side ? `&side=${side}` : "";
  const weekHref = (key: string) => `${c.hrefs.schedule(key)}${sideQ}`;
  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Schedule</span>
        <h1>This week</h1>
        <p>Regular gatherings and offerings, week by week. Times are Toronto time.</p>
        <nav className="so-chips" aria-label="Filter the schedule">
          <a className="so-chip" href={c.hrefs.schedule(monday)} aria-current={!side ? "true" : undefined}>All</a>
          <a className="so-chip" href={`${c.hrefs.schedule(monday)}&side=inner`} aria-current={side === "inner" ? "true" : undefined}>Inner</a>
          <a className="so-chip" href={`${c.hrefs.schedule(monday)}&side=outer`} aria-current={side === "outer" ? "true" : undefined}>Outer</a>
        </nav>
      </header>
      <nav className="so-weeknav" aria-label="Weeks">
        <a href={weekHref(shiftWeek(monday, -1))}>← Previous week</a>
        <strong>{dayLabel(days[0].key)} – {dayLabel(days[6].key)}</strong>
        <a href={weekHref(shiftWeek(monday, 1))}>Next week →</a>
      </nav>
      {!c.offerings ? <p className="so-empty">No schedule is connected.</p> : <WeekList c={c} days={days} items={items} />}
    </main>
  );
}
