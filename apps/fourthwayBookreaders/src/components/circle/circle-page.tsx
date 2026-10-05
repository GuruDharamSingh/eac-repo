import Link from "next/link";
import { BookOpen, CalendarDays, Clock, FileText, Flag, Folder, MessageSquare, PlayCircle, Repeat, Users } from "lucide-react";
import type { Thread } from "@/lib/types";
import type { Viewer } from "@/lib/auth";
import type { CirclePageData, SessionView } from "@/lib/circle-page";
import {
  createSessionDocument,
  postSessionComment,
  rsvpSession,
  setUpCircleSpace,
} from "@/lib/circle-actions";
import { RsvpButton } from "@/components/rsvp-button";
import { BookCoverFallback } from "@/components/home/book-cover-fallback";
import { formatDay, formatDuration, formatRecurrence, formatWhen } from "@/lib/format";
import { CircleTabs, MaterialReader, SessionLinks } from "./circle-client";
import { CircleSurfaces, DefineWord, NewSessionThreadButton, OpenThreadButton } from "./circle-surfaces";
import { CircleManage } from "./circle-manage";

/**
 * A reading circle's page. The whole page is the circle's workspace: the head
 * (cover, the group box) is public; the sittings, recordings and discussion
 * are for org members; the manage section at the bottom is for owners and
 * guides.
 */

function lengthText(n: number | null, unit: "pages" | "seconds") {
  if (n == null) return null;
  return unit === "pages" ? `${n} pp.` : `${Math.round(n / 60)} min`;
}

function SessionPanel({
  s,
  group,
  data,
  viewer,
}: {
  s: SessionView;
  group: Thread;
  data: CirclePageData;
  viewer: Viewer;
}) {
  const at = new Date(s.occurrenceAt);
  const past = at.getTime() < Date.now() - 60 * 60 * 1000;
  const common = (
    <>
      <input type="hidden" name="groupId" value={group.id} />
      <input type="hidden" name="occurrenceAt" value={s.occurrenceAt} />
    </>
  );

  return (
    <div className="session">
      <div className="session__head">
        <p className="eyebrow" style={{ margin: 0 }}>Session {s.number}</p>
        <p className="session__when">{formatWhen(at)}</p>
        {/* Host, count and the RSVP on one line, on phones too. */}
        <div className="session__metarow">
          <p className="session__meta">
            {s.host ? <>Host: <strong>{s.host.name}</strong></> : "No host yet"}
            {" · "}
            {s.rsvp.count} {past ? "came" : "coming"}
          </p>
          {!past && (
            <form action={rsvpSession} className="session__rsvp">
              {common}
              <input type="hidden" name="going" value={s.rsvp.going ? "no" : "yes"} />
              <button className={s.rsvp.going ? "btn btn--small" : "btn btn--small btn--primary"} aria-pressed={s.rsvp.going}>
                {s.rsvp.going ? "RSVP'd ✓ — cancel" : "RSVP"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* The way in, in order: the call first, then the reading and its document. */}
      <section className="session__block session__links">
        <h3 className="session__title">Use these links to connect</h3>
        <div className="session-step">
          <span className="session-step__n" aria-hidden>1</span>
          <div className="session-step__body">
            <SessionLinks only="call" talkUrl={data.talkUrl} documentUrl={null} createDocument={null} />
            <p className="session__notice">
              Once the room opens, click the call icon to join the call. Sessions are recorded (video)
              automatically once two people are in the call; recordings are kept in this group&rsquo;s session
              folder, for its members.
            </p>
          </div>
        </div>
        <div className="session-step">
          <span className="session-step__n" aria-hidden>2</span>
          <div className="session-step__body">
            <p className="session-step__label"><BookOpen size={14} aria-hidden /> Open the reading</p>
            {s.plan && <p className="session__plan">{s.plan}</p>}
            {s.stoppedAt && <p className="session__meta" style={{ margin: "0 0 6px" }}>Stopped at {s.stoppedAt}</p>}
            {s.material.length > 0 ? (
              <MaterialReader
                items={s.material.map((m) => ({
                  unitId: m.unitId,
                  label: m.label,
                  title: m.title,
                  href: m.href,
                  startPage: m.startPage,
                  meta: lengthText(m.length, m.lengthUnit),
                }))}
              />
            ) : (
              <p className="empty">Nothing planned{data.canEdit ? " — add units in Manage below." : "."}</p>
            )}
          </div>
        </div>
      </section>

      <section className="session__block session__discussion">
        <div className="session__discussion-head">
          <div>
            <h3 className="session__title"><MessageSquare size={15} aria-hidden /> Discussion</h3>
            <p className="session__meta" style={{ margin: 0 }}>
              Topic: <strong>{s.topic ? <Link href={s.topic.href}>{s.topic.title}</Link> : `Session ${s.number} (made with the first comment)`}</strong>
              {data.feedName && (
                <>
                  {" · "}Category:{" "}
                  {data.forumUrl ? <a href={data.forumUrl} target="_blank" rel="noreferrer">{data.feedName}</a> : data.feedName}
                </>
              )}
            </p>
          </div>
        </div>
        {s.threads.length > 0 && (
          <ul className="session__threads">
            {s.threads.map((t) => (
              <li key={t.id}>
                <OpenThreadButton id={t.id}>{t.title}</OpenThreadButton>
                <span className="session__byline">{t.author ?? "A member"} · {formatDay(new Date(t.at))}</span>
              </li>
            ))}
          </ul>
        )}
        {s.comments.length > 0 ? (
          <ol className="session__comments">
            {s.comments.map((c) => (
              <li key={c.id}>
                <p className="session__byline"><strong>{c.author}</strong> · {formatDay(new Date(c.at))}</p>
                <div className="prose" dangerouslySetInnerHTML={{ __html: c.html }} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">No comments yet.</p>
        )}
        <form action={postSessionComment} className="session__form">
          {common}
          <textarea name="text" rows={3} className="field" placeholder="Add a comment on this session" required />
          <div className="session__form-actions">
            <button className="btn btn--primary">Comment</button>
            <NewSessionThreadButton groupId={group.id} occurrenceAt={s.occurrenceAt} />
          </div>
        </form>
      </section>

      <section className="session__block session__document">
        <SessionLinks
          only="document"
          talkUrl={null}
          documentUrl={s.documentUrl}
          createDocument={
            <form action={createSessionDocument}>
              {common}
              <button className="btn session-links__btn"><FileText size={14} aria-hidden /> Start the session document</button>
            </form>
          }
        />
      </section>

      <section className="session__block session__define">
        <DefineWord sourceThreadId={s.topic?.id} />
      </section>
    </div>
  );
}

export function CirclePage({
  group,
  data,
  viewer,
  going,
  displayName,
  talkBaseUrl,
}: {
  group: Thread;
  data: CirclePageData;
  viewer: Viewer | null;
  going: boolean;
  displayName: string | null;
  talkBaseUrl: string | null;
}) {
  const finished = Boolean(group.endsOn && group.endsOn.getTime() < Date.now());
  const pct = data.progress.unitsTotal ? Math.round((data.progress.unitsDone / data.progress.unitsTotal) * 100) : 0;
  const tabs = (["previous", "current", "next"] as const).map((slot) => {
    const s = data.sessions[slot];
    return {
      id: slot,
      label: slot === "previous" ? "Previous session" : slot === "current" ? "This session" : "Next session",
      sub: s ? formatDay(new Date(s.occurrenceAt)) : null,
      panel: s && viewer ? (
        <SessionPanel s={s} group={group} data={data} viewer={viewer} />
      ) : (
        <p className="empty">{data.scheduled ? "No sitting here." : "The circle has no schedule yet."}</p>
      ),
    };
  });

  const head = (
    <>
      <p className="eyebrow"><Link href="/groups">← groups</Link></p>
      <h1 className="circle-page__title">{group.title} <span>reading group</span></h1>

      <div className="circle-head">
        <figure className="circle-head__cover">
          {group.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.coverImageUrl} alt={`${group.title} — cover`} />
          ) : (
            <BookCoverFallback title={group.bookTitle ?? group.title} author={group.bookAuthor} />
          )}
        </figure>

        <aside className="attend circle-head__box">
          <div className="attend__head">{finished ? "This group has finished" : "The group"}</div>
          <div className="attend__body">
            <div className="attend__when" style={{ marginTop: 0 }}>
              {group.bookTitle && <span><BookOpen size={13} aria-hidden /> {group.bookTitle}{group.bookAuthor ? ` — ${group.bookAuthor}` : ""}</span>}
              {group.nextOccurrenceAt && !finished && <span><CalendarDays size={13} aria-hidden /> next: {formatWhen(group.nextOccurrenceAt)}</span>}
              {formatDuration(group.durationMinutes) && <span><Clock size={13} aria-hidden /> {formatDuration(group.durationMinutes)}</span>}
              {formatRecurrence(group.recurrencePattern) && <span><Repeat size={13} aria-hidden /> {formatRecurrence(group.recurrencePattern)}</span>}
              <span><Users size={13} aria-hidden /> {data.readers} {data.readers === 1 ? "reader" : "readers"}</span>
            </div>
            {!finished && group.isRsvpEnabled && (
              <RsvpButton threadId={group.id} signedIn={Boolean(viewer)} going={going} returnTo={`/groups/${group.slug}`} joining />
            )}
          </div>
        </aside>
      </div>
    </>
  );

  const body = (
    <>
      {data.isMember && !data.hasSpace && data.canEdit && (
        <form action={setUpCircleSpace} className="card" style={{ margin: "18px 0" }}>
          <input type="hidden" name="groupId" value={group.id} />
          <p style={{ margin: "0 0 10px" }}>This circle has no folder, Talk room or discussion yet.</p>
          <button className="btn btn--primary">Set up the circle&rsquo;s space</button>
        </form>
      )}

      {data.isMember ? (
        <section id="sessions" className="band">
          <CircleTabs tabs={tabs} initial={data.sessions.current ? "current" : data.sessions.previous ? "previous" : "next"} />
          {data.archive.length > 0 && (
            <details className="circle-archive">
              <summary>Archive of sessions ({data.archive.length})</summary>
              <ul className="booklist">
                {data.archive.map((a) => (
                  <li key={a.occurrenceAt}>
                    {a.href ? (
                      <Link href={a.href}>
                        <span className="booklist__author" style={{ minWidth: 110 }}>{formatDay(new Date(a.occurrenceAt))}</span>
                        <span className="booklist__title">Session {a.number}</span>
                        {a.stoppedAt && <span className="booklist__note">stopped at {a.stoppedAt}</span>}
                      </Link>
                    ) : (
                      <span className="booklist__dead">
                        <span className="booklist__author" style={{ minWidth: 110 }}>{formatDay(new Date(a.occurrenceAt))}</span>
                        <span className="booklist__title">Session {a.number}</span>
                        {a.stoppedAt && <span className="booklist__note">stopped at {a.stoppedAt}</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ) : (
        <p className="empty" style={{ marginTop: 24 }}>
          The sessions, reading and discussion open once you join the group.{" "}
          {viewer ? "Use “Join the group” above." : <><Link href="/login">Sign in</Link>, then join the group.</>}
        </p>
      )}

      <div className="split">
        <section className="band">
          <div className="band__head"><h2 className="band__title">Progress</h2></div>
          {data.progress.unitsTotal === 0 ? (
            <p className="empty">Nothing planned yet.</p>
          ) : (
            <div className="card">
              <div className="circle__bar" role="img" aria-label={`${data.progress.unitsDone} of ${data.progress.unitsTotal} read`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <p style={{ margin: "8px 0 4px" }}>
                <strong>{data.progress.unitsLeft}</strong> of {data.progress.unitsTotal} left to read
                {" · "}{data.progress.held} session{data.progress.held === 1 ? "" : "s"} held
              </p>
              <p style={{ margin: 0, color: "var(--ink-muted)" }}>
                About {data.progress.sessionsLeft} more session{data.progress.sessionsLeft === 1 ? "" : "s"} at {data.progress.pace} per sitting
                {data.progress.projectedFinish ? `, finishing around ${formatDay(new Date(data.progress.projectedFinish))}` : ""}.
                Each session starts where the last one stopped.
              </p>
            </div>
          )}
        </section>

        <section className="band">
          <div className="band__head"><h2 className="band__title">Reading structure</h2></div>
          {data.structureHtml ? (
            <div className="prose card" dangerouslySetInnerHTML={{ __html: data.structureHtml }} />
          ) : (
            <p className="empty">No reading structure yet{data.canEdit ? " — write one in Manage below." : "."}</p>
          )}
        </section>
      </div>

      {data.isMember && data.recordings.length > 0 && (
        <section className="band">
          <div className="band__head"><h2 className="band__title">Session folders</h2><span className="eyebrow">recordings, transcripts, notes</span></div>
          <ul className="booklist">
            {data.recordings.map((r) => (
              <li key={r.folder}>
                <span className="booklist__dead"><Folder size={14} aria-hidden /><span className="booklist__title">{r.folder}</span></span>
                {r.files.map((f) => (
                  <a key={f.href} href={f.href} target="_blank" rel="noreferrer" style={{ paddingLeft: 28 }}>
                    {/\.(mp4|webm|mkv|mov|m4a|mp3|ogg|wav)$/i.test(f.name) ? <PlayCircle size={13} aria-hidden /> : <FileText size={13} aria-hidden />}
                    <span className="booklist__title">{f.name}</span>
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.isMember && data.forumUrl && (
        <p className="eyebrow" style={{ marginTop: 8 }}>
          All of this circle&rsquo;s topics: <a href={data.forumUrl} target="_blank" rel="noreferrer">the forum category →</a>
        </p>
      )}

      {data.canEdit && <CircleManage group={group} data={data} />}
    </>
  );

  return (
    <article className="column band circle-page">
      {head}
      {data.isMember ? (
        <CircleSurfaces
          signedIn={Boolean(viewer)}
          isMember={data.isMember}
          canEdit={data.canEdit}
          displayName={displayName}
          feed={data.feedSlug ? { slug: data.feedSlug, name: group.title } : null}
          talkBaseUrl={talkBaseUrl}
        >
          {body}
        </CircleSurfaces>
      ) : (
        body
      )}
    </article>
  );
}
