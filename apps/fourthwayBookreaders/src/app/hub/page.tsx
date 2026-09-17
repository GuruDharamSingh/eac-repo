import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Folder } from "lucide-react";
import { listOrgFiles, listOrgMembers } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import {
  getAttendanceCount,
  getCurrentGroupThread,
  getMeetingRecordings,
  getUpcomingThreads,
} from "@/lib/data";
import { ThreadCard, threadHref } from "@/components/thread-card";
import { Theatre } from "@/components/home/theatre";
import { formatWhen } from "@/lib/format";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

/**
 * The members' hub — first cut.
 *
 * Deliberately NOT the surface-system hub that amrit-canada and IFAC run
 * (@elkdonis/cms-ui/hub: calendar popups, chat, pipeline, whiteboard). That
 * hub needs the HubSurfaces provider in the root layout plus a dozen
 * /api/hub/* routes behind it, and porting all of that before this circle has
 * a single member would be building for nobody. What is here is what a member
 * of a reading circle opens the hub to check: when we meet, who's coming,
 * what was recorded, and where the files are.
 *
 * The upgrade path is mechanical when it's wanted: mount HubSurfaces in
 * layout.tsx, copy amrit-canada's /api/hub/*, and swap these cards for faces.
 */
export default async function HubPage() {
  const viewer = await requireOrgMember("/hub");

  const [current, upcoming, recordings, files, members] = await Promise.all([
    getCurrentGroupThread(),
    getUpcomingThreads(8),
    getMeetingRecordings(24),
    // The top level of the circle's cloud folder. The service account can read
    // every org's tree, so requireOrgMember above IS the access decision.
    listOrgFiles(siteConfig.orgId, "").catch(() => []),
    // Followers hold a `viewer` row too, but following is not membership.
    listOrgMembers(siteConfig.orgId)
      .then((all) => all.filter((m) => m.role !== "viewer"))
      .catch(() => []),
  ]);
  const attending = current ? await getAttendanceCount(current.id) : 0;

  return (
    <div className="column band">
      <p className="eyebrow">{siteConfig.orgName}</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>Hub</h1>
      <p style={{ marginTop: 8, maxWidth: "60ch", color: "var(--ink-muted)", fontSize: "0.94rem" }}>
        For members of the circle: when we meet, what was recorded, and where things are kept.
      </p>

      <div className="split" style={{ marginTop: 26 }}>
        <div>
          <div className="band__head"><h2 className="band__title">Now sitting</h2></div>
          {current ? (
            <ThreadCard thread={current} attending={attending} />
          ) : (
            <div className="empty">Nothing scheduled.</div>
          )}
        </div>

        <div>
          <div className="band__head">
            <h2 className="band__title">Coming up</h2>
            <Link href="/calendar" className="band__more">Calendar →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty">Nothing on the calendar yet.</div>
          ) : (
            <ul className="booklist">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link href={threadHref(t)}>
                    <span className="booklist__title">{t.title}</span>
                    <span className="booklist__author">{formatWhen(t.nextOccurrenceAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="band">
        <div className="band__head"><h2 className="band__title">Recordings</h2></div>
        <Theatre recordings={recordings} />
      </section>

      <div className="split">
        <div>
          <div className="band__head"><h2 className="band__title">The circle&rsquo;s files</h2></div>
          {files.length === 0 ? (
            <div className="empty">The shared folder is empty, or storage isn&rsquo;t reachable right now.</div>
          ) : (
            <ul className="booklist">
              {files.map((f) => (
                <li key={f.path}>
                  {f.isFolder ? (
                    <span className="booklist__dead">
                      <Folder size={14} aria-hidden />
                      <span className="booklist__title">{f.name}</span>
                      <span className="booklist__author">folder</span>
                    </span>
                  ) : (
                    <a href={withBase(f.url)} target="_blank" rel="noreferrer">
                      <FileText size={14} aria-hidden />
                      <span className="booklist__title">{f.name}</span>
                      <span className="booklist__author">{(f.size / 1024).toFixed(0)} KB</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="band__head"><h2 className="band__title">Who&rsquo;s in the circle</h2></div>
          {members.length === 0 ? (
            <div className="empty">No members listed.</div>
          ) : (
            <ul className="booklist">
              {members.slice(0, 20).map((m) => (
                <li key={m.userId}>
                  <span className="booklist__dead">
                    <span className="booklist__title">{m.displayName ?? "A reader"}</span>
                    <span className="booklist__author">{m.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="card__actions">
            <Link href="/center" className="btn">Your center</Link>
            {viewer.canEdit && <Link href="/manage" className="btn btn--primary">Manage the site</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
