import type { Metadata } from "next";
import Link from "next/link";
import { getAttendanceCount, getFinishedGroups, getReadingGroups, getUpcomingThreads } from "@/lib/data";
import { READING_GROUP_KIND } from "@/lib/types";
import { threadHref } from "@/components/thread-card";
import { formatDay } from "@/lib/format";
import { ThreadCard } from "@/components/thread-card";
import { Invitation } from "@/components/home/bands";
import { getPaathReader } from "@/lib/paath";

export const metadata: Metadata = { title: "Reading groups" };

export default async function GroupsPage() {
  const [groups, upcoming, finished] = await Promise.all([
    getReadingGroups(24),
    getUpcomingThreads(24),
    getFinishedGroups(12),
  ]);
  const readers = await Promise.all(groups.map((g) => getAttendanceCount(g.id)));
  // Private: shown only to its readers (src/lib/paath.ts).
  const paath = await getPaathReader().catch(() => null);
  // One-off gatherings (a talk, a visit) sit under the groups, not among them.
  const others = upcoming.filter((t) => t.kind !== READING_GROUP_KIND);
  return (
    <div className="column band">
      <p className="eyebrow">Reading groups</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>The circles</h1>

      <div className="split" style={{ marginTop: 24 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {groups.length === 0 ? (
            <div className="empty">No reading group is sitting at the moment.</div>
          ) : (
            groups.map((g, i) => <ThreadCard key={g.id} thread={g} attending={readers[i]} />)
          )}
          {others.length > 0 && (
            <>
              <div className="band__head" style={{ marginTop: 14 }}><h2 className="band__title">Also coming up</h2></div>
              {others.map((t) => <ThreadCard key={t.id} thread={t} />)}
            </>
          )}
          {finished.length > 0 && (
            <>
              <div className="band__head" style={{ marginTop: 14 }}><h2 className="band__title">Groups that have finished</h2></div>
              <ul className="booklist">
                {finished.map((g) => (
                  <li key={g.id}>
                    <Link href={threadHref(g)}>
                      <span className="booklist__title">{g.title}</span>
                      <span className="booklist__author">{g.bookTitle ?? ""}{g.endsOn ? ` · until ${formatDay(g.endsOn)}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          {paath && (
            <div className="card" style={{ marginBottom: 24 }}>
              <p className="eyebrow">{paath.circle.isPrivate ? "Private · only its readers see this" : "Reading now"}</p>
              <h2 className="card__title">Akhand Path</h2>
              <p className="card__body">A complete reading of the Sri Guru Granth Sahib, passage by passage, day by day.</p>
              <div className="card__actions">
                <Link href="/akhand-path" className="btn btn--primary">Continue reading</Link>
              </div>
            </div>
          )}
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="eyebrow">Read online</p>
            <h2 className="card__title">Sri Guru Granth Sahib</h2>
            <p className="card__body">The whole Granth, Ang by Ang, in Gurmukhi with an English translation.</p>
            <div className="card__actions">
              <Link href="/granth" className="btn">Open the Granth</Link>
            </div>
          </div>
          <Invitation />
          <div className="card" id="host" style={{ marginTop: 24, scrollMarginTop: 90 }}>
            <h2 className="card__title">Host a session</h2>
            <p className="card__body">
              A session needs a room, a reader, and someone to keep the time. If
              you can offer one — in person or on a call — tell the circle and
              we&rsquo;ll put it on the calendar.
            </p>
            <div className="card__actions">
              <Link href="/suggest?kind=host" className="btn btn--primary">Offer to host</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
