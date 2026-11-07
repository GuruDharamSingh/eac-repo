import Link from "next/link";
import type { Metadata } from "next";
import { getStandingMeeting, listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { StandingMeetingFace } from "@elkdonis/cms-ui/hub";
import { HubCalendar } from "@elkdonis/cms-ui/hubsite";
import { ForumFace } from "@elkdonis/cms-ui/surface";
import { EventStage } from "@elkdonis/series-site/components/event-stage";
import { seriesStageSlide } from "@elkdonis/series-site/stage";
import { ThreadCard } from "@/components/thread-card";
import { eventForViewer, getSiteSections, getThreadsForFeed, standingForViewer } from "@/lib/data";
import { getForumSnapshot } from "@/lib/forum";
import { currentSeries } from "@/lib/public-site";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { SiteShell } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community",
  description: `Meetings, the calendar, materials and the forum at ${siteConfig.orgName}.`,
};

/** Community (2026-11-02): the promoted series and the public weekly meeting, the calendar and materials, the forum, other sites. */
export default async function CommunityPage() {
  const now = new Date();
  const from = startOfMonth(now);
  const [sections, entries, standingRow, eventRows, materials, forum, viewer] = await Promise.all([
    getSiteSections(),
    currentSeries(),
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1)).catch(() => []),
    getThreadsForFeed("materials", 6).catch(() => []),
    getForumSnapshot().catch(() => null),
    getViewer().catch(() => null),
  ]);
  const standing = standingForViewer(standingRow, Boolean(viewer));
  const events = eventRows.map((e) => eventForViewer(e, Boolean(viewer)));
  const copy = sections.materials ?? {};
  const slides = entries.map((e) => seriesStageSlide(e.series, { many: entries.length > 1, onlineLabel: "Online", editHref: viewer?.canEdit ? `/hub/series/${e.series.id}#settings` : null }));
  const elsewhere = [
    { label: "Elkdonis Arts Collective", url: siteConfig.collectiveUrl, note: "The collective this site belongs to" },
    { label: "Arts Collective", url: "https://arts-collective.com", note: "The network of sites" },
    { label: "The directory", url: "https://directory.arts-collective.com", note: "Artists across the network" },
    { label: "Collect Art", url: "https://market.arts-collective.com", note: "The network's market" },
  ];

  return (
    <SiteShell>
      <div className="pts-snap">
        <section className="pts-panel" data-edit-section="community-meetings" data-edit-name="Meetings">
          <div className="pts-wrap pts-stack">
            <header className="pts-head">
              <div>
                <p className="ifs-eyebrow">Community</p>
                <h1 className="pts-h1">Meet with us</h1>
              </div>
              <Link className="ifs-btn" href="/series">All series</Link>
            </header>
            {slides.length > 0 && <EventStage slides={slides} />}
          </div>
        </section>

        <section className="pts-panel pts-panel--line" data-edit-section="community-weekly" data-edit-name="Weekly meeting">
          <div className="pts-wrap pts-stack">
            <header className="pts-head">
              <div>
                <p className="ifs-eyebrow">Every week</p>
                <h2>The public meeting</h2>
              </div>
            </header>
            <div className="landing-standing pts-standing">
              <StandingMeetingFace standing={standing} canEdit={Boolean(viewer?.canEdit)} timeZone={siteConfig.timeZone} />
            </div>
          </div>
        </section>

        <section className="pts-panel pts-panel--line" data-edit-section="community-calendar" data-edit-name="Calendar and materials">
          <div className="pts-wrap pts-cq">
            <div className="pts-split">
              <HubCalendar initialEvents={events} />
              <div className="pts-stack">
                <div>
                  <p className="ifs-eyebrow">{copy.title ?? "Suggested materials"}</p>
                  {copy.body && <p className="ifs-muted">{copy.body}</p>}
                </div>
                {materials.length > 0 ? (
                  materials.map((t) => <ThreadCard key={t.id} thread={t} feedName="Materials" />)
                ) : (
                  <p className="ifs-muted">Nothing here yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="pts-panel pts-panel--line" data-edit-section="community-forum" data-edit-name="Forum and links">
          <div className="pts-wrap pts-stack">
            <header className="pts-head">
              <div>
                <p className="ifs-eyebrow">Forum</p>
                <h2>Talk it over</h2>
              </div>
              <Link className="ifs-btn" href="/forum">Open the forum</Link>
            </header>
            <ForumFace forum={forum} href="/forum" />
            <div>
              <p className="ifs-eyebrow">Elsewhere</p>
              <ul className="pts-links">
                {elsewhere.map((l) => (
                  <li key={l.url}>
                    <a href={l.url}><b>{l.label}</b><span>{l.note}</span></a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
