import Link from "next/link";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { getStandingMeeting } from "@elkdonis/services";
import { StandingMeetingFace } from "@elkdonis/cms-ui/hub";
import { ForumFace } from "@elkdonis/cms-ui/surface";
import { coverFrameStyle } from "@elkdonis/cms-ui/files";
import { EventStage } from "@elkdonis/series-site/components/event-stage";
import { JoinFrame } from "@elkdonis/series-site/components/join-frame";
import { seriesStageSlide } from "@elkdonis/series-site/stage";
import { getSiteSections, standingForViewer } from "@/lib/data";
import { getForumSnapshot } from "@/lib/forum";
import { getImageSpaces, mediaSrc } from "@/lib/landing";
import { currentSeries } from "@/lib/public-site";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { SiteShell } from "@/lib/series-site";
import { BannerEditor } from "@/components/site/banner-editor";
import { EditPageButton } from "@/components/landing/EditPageButton";
import { LiveRoot, nodePartKey } from "@/blocks/home-blocks";
import { pickStanding, whichOf } from "@/lib/puck/data-standing";
import { landingPublishedConfig } from "@/lib/puck/config.landing";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { loadPage } from "@/lib/puck/store";

export const dynamic = "force-dynamic";

/**
 * The landing page (2026-11-02), three screens that scroll a page at a time:
 *   1. the banner (uploaded and framed from "Change banner") and the series' hero card;
 *   2. some of the community: the public weekly meeting and the forum;
 *   3. who we are, with the sign-up frame for visitors.
 * Sections carry `data-edit-section` for the direct-editing layer. The Puck home page this replaces is
 * retired; its `site_config` row was deleted once this page was live.
 *
 * Editors can edit it in place (2026-11-05). Until that is saved it draws from this code. After saving,
 * `puck:landing` is the page: its words stop following /manage/pages, and the live pieces below stay live.
 * "Restore" returns to this code.
 */
const KNOWN_TYPES = new Set(Object.keys(landingPublishedConfig.components));

export default async function HomePage() {
  const [sections, spaces, entries, standingRow, forum, viewer, tree] = await Promise.all([
    getSiteSections(),
    getImageSpaces(),
    currentSeries(),
    (async () => getStandingMeeting(siteConfig.orgId, await getViewer().catch(() => null)))().catch(() => null),
    getForumSnapshot().catch(() => null),
    getViewer().catch(() => null),
    loadPage(LANDING_SLUG, KNOWN_TYPES).catch(() => null),
  ]);
  const standing = standingForViewer(standingRow, Boolean(viewer));
  const hero = sections.hero ?? {};
  const about = sections.about ?? {};
  const banner = spaces.hero ?? {};
  const bannerSrc = mediaSrc(banner.path);
  const canEdit = Boolean(viewer?.canEdit);
  const slides = entries.map((e) => seriesStageSlide(e.series, { many: entries.length > 1, onlineLabel: "Online", editHref: viewer?.canEdit ? `/hub/series/${e.series.id}#settings` : null }));

  // What stays live when the page is edited as a tree: these follow the data and whoever is looking. The picture
  // is marked for the editor; the button beside it is only ever drawn for an editor, so a visitor's copy has none.
  const parts = {
    banner: (
      <>
        {bannerSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerSrc} alt={banner.alt ?? ""} fetchPriority="high" style={coverFrameStyle(banner.frame)} data-landing-part="banner" data-edit-name="Banner picture" />
        )}
        {canEdit && <BannerEditor url={bannerSrc} alt={banner.alt ?? ""} frame={banner.frame ?? null} />}
      </>
    ),
    "home-stage": <EventStage slides={slides} />,
    "home-standing": <StandingMeetingFace standing={standing} canEdit={canEdit} timeZone={siteConfig.timeZone} />,
    "home-forum": <ForumFace forum={forum} href="/forum" />,
    "home-join": viewer ? (
      <div className="pts-note">
        <p className="ifs-eyebrow">You are signed in</p>
        <p>The series, its sessions and the forum are open to you.</p>
        <Link className="ifs-btn ifs-btn--primary" href={viewer.isMember ? "/hub" : "/center"}>{viewer.isMember ? "Go to the hub" : "Go to your center"}</Link>
      </div>
    ) : (
      <JoinFrame next="/center" />
    ),
  };

  // Once the page has been saved as a tree, the tree is the page.
  if (tree) {
    // A Next gathering that shows something other than the standing meeting (2026-11-14, `which`): drawn per node.
    const chosen = standingNodes(tree.data);
    const own = await Promise.all(chosen.map(async ({ id, which }) => {
      const row = await pickStanding(which, viewer).catch(() => null);
      return [nodePartKey("home-standing", id), <StandingMeetingFace key={id} standing={standingForViewer(row, Boolean(viewer))} canEdit={canEdit} timeZone={siteConfig.timeZone} />] as const;
    }));
    const metadata = { orgId: siteConfig.orgId, slug: LANDING_SLUG, parts: { ...parts, ...Object.fromEntries(own) } };
    const filled = await resolveAllData(tree.data as Data, landingPublishedConfig, metadata);
    return (
      <SiteShell>
        <div className="pts-snap">
          <Render config={landingPublishedConfig} data={filled as Data} metadata={metadata} />
        </div>
        {canEdit && <EditPageButton tree={tree.data as PuckDoc} />}
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="pts-snap">
        <section className="pts-panel pts-hero" data-edit-section="hero" data-edit-name="Banner and series">
          <div className={`pts-banner${slides.length === 0 ? " pts-banner--tall" : ""}`}>
            {parts.banner}
            <div className="pts-banner__words">
              {hero.eyebrow && <p className="ifs-eyebrow">{hero.eyebrow}</p>}
              <h1>{hero.title ?? siteConfig.orgName}</h1>
              {(hero.subtitle ?? siteConfig.tagline) && <p className="pts-banner__sub">{hero.subtitle ?? siteConfig.tagline}</p>}
            </div>
          </div>
          {slides.length > 0 && <LiveRoot id="home-stage">{parts["home-stage"]}</LiveRoot>}
        </section>

        <section className="pts-panel pts-panel--line" data-edit-section="community" data-edit-name="Community">
          <div className="pts-wrap pts-stack">
            <header className="pts-head">
              <div>
                <p className="ifs-eyebrow">Community</p>
                <h2>Meet, read and talk</h2>
              </div>
              <Link className="ifs-btn" href="/community">The community page</Link>
            </header>
            <div className="pts-cq">
              <div className="pts-split">
                <LiveRoot id="home-standing">{parts["home-standing"]}</LiveRoot>
                <LiveRoot id="home-forum">{parts["home-forum"]}</LiveRoot>
              </div>
            </div>
          </div>
        </section>

        <section className="pts-panel pts-panel--line" data-edit-section="about" data-edit-name="Who we are">
          <div className="pts-wrap pts-cq">
            <div className="pts-split pts-split--center">
              <div className="pts-stack">
                <p className="ifs-eyebrow">About</p>
                <h2 className="pts-h2">{siteConfig.orgName}</h2>
                <p className="pts-lede">{firstLines(about.body) ?? siteConfig.tagline}</p>
                <div><Link className="ifs-btn" href="/about">Read more</Link></div>
              </div>
              <LiveRoot id="home-join">{parts["home-join"]}</LiveRoot>
            </div>
          </div>
        </section>
      </div>
      {canEdit && <EditPageButton tree={null} />}
    </SiteShell>
  );
}

/** The home-standing nodes of a stored tree whose `which` is not the standing meeting (data-standing.ts `whichOf`). */
function standingNodes(data: unknown): Array<{ id: string; which: string }> {
  const out: Array<{ id: string; which: string }> = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list as Array<{ type?: unknown; props?: Record<string, unknown> }>) {
      if (!n || typeof n !== "object" || !n.props) continue;
      const id = n.props.id;
      if (n.type === "home-standing" && typeof id === "string" && whichOf(n.props.which) !== "standing") out.push({ id, which: whichOf(n.props.which) });
      for (const v of Object.values(n.props)) walk(v);
    }
  };
  walk((data as { content?: unknown } | null)?.content);
  return out.slice(0, 8);
}

/** The opening lines of the about copy: its third paragraph on is for the About page. */
function firstLines(body: string | undefined): string | null {
  if (!body) return null;
  const paragraphs = body.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p && !p.startsWith("mailto:"));
  return paragraphs.find((p) => p.length > 60) ?? paragraphs[0] ?? null;
}
