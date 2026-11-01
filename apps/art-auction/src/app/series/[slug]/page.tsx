import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cormorant, jost } from "./series-fonts";
import { getSeriesBySlug, listSeriesLots } from "@elkdonis/commerce/queries";
import { canEditSeries, canParticipateInSeries, getMarketplaceSettings, listWeekBoards, getSeriesOverview, listSeriesDiscussion, seriesFollowState, listSeriesOrgs } from "@elkdonis/commerce/server";
import { getCurrentUserId, getCurrentUser } from "@/lib/marketplace-auth";
import { FORUM_URL } from "@/lib/article-data";
import {
  themeOf, currentWeek, safeSrc,
  SrsNav, SrsHero, SrsBar, SrsCurator, SrsWeeks, SrsLots, SrsJournal, SrsArticles, SrsFooter,
} from "./series-template";
import { EditorBar, HeroEditButtons, EditWriteUpButton, AddArticleButton } from "./page-editor";
import { SrsDiscussion } from "./series-social";
import "./series-template.css";
import "./manage/workspace.css";

export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  if (!s) return { title: "Auction series" };
  const img = safeSrc(s.card.imageUrl) ?? (themeOf(s).hero?.kind === "image" ? safeSrc(themeOf(s).hero?.url) : null);
  return {
    title: s.title,
    description: s.card.blurb ?? s.subtitle ?? undefined,
    openGraph: img ? { images: [img] } : undefined,
  };
}

/**
 * The series page (2026-10-28), from the developer's "Series page" template:
 * video or image hero, series bar, the curator's write-up beside where the
 * money goes, the weeks, the lots, the journal and the articles. Editors and
 * contributors edit in place (page-editor.tsx). A draft is visible only to
 * the team.
 */
export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const userId = await getCurrentUserId();
  const editor = userId ? await canEditSeries(userId, series.id) : false;
  const contributor = !editor && userId ? await canParticipateInSeries(userId, series.id) : false;
  if (series.status === "draft" && !editor && !contributor) notFound();

  const [lots, weeks, overview, settings, discussion, follow, orgs, viewer] = await Promise.all([
    listSeriesLots(series.id),
    listWeekBoards(series.id, { publicOnly: true }),
    getSeriesOverview(series.id),
    getMarketplaceSettings(series.orgId),
    listSeriesDiscussion(series.id, userId, 12),
    seriesFollowState(series.id, userId),
    listSeriesOrgs(series.id),
    userId ? getCurrentUser() : Promise.resolve(null),
  ]);
  const partners = orgs.filter((o) => o.status === "accepted").map((o) => o.name);
  const theme = themeOf(series);
  const showLots = series.phase === "silent" || series.phase === "live" || series.phase === "closed" || editor;
  const role = editor ? "editor" : contributor ? "contributor" : null;
  const week = currentWeek(series) ?? 1;

  // The journal: the team's dated notes, plus the series' own milestones once passed.
  const now = Date.now();
  const journal = [
    ...(theme.journal ?? []).filter((j) => j.date && j.text),
    ...(series.silentOpensAt && new Date(series.silentOpensAt).getTime() <= now
      ? [{ date: series.silentOpensAt, text: `Silent bidding opened${lots.length ? ` with ${lots.length} lots` : ""}.` }]
      : []),
    ...(series.liveAt && new Date(series.liveAt).getTime() <= now ? [{ date: series.liveAt, text: "The live close began." }] : []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className={`srs ${cormorant.variable} ${jost.variable}`}>
      {role && <EditorBar series={series} role={role} defaultWeek={week} />}
      <SrsNav signedIn={Boolean(userId)} />
      <SrsHero series={series} hero={theme.hero ?? null} curator={theme.curator ?? null} editControls={editor ? <HeroEditButtons series={series} /> : undefined} />
      <SrsBar series={series} lots={lots} artistCount={overview.artistCount} />
      <main className="srs-main srs-wrap">
        <SrsCurator series={series} theme={theme} commissionPercent={settings.defaultCommissionRate} editControl={editor ? <EditWriteUpButton series={series} /> : undefined} />
        <SrsWeeks series={series} weeks={weeks} />
        <SrsLots
          series={series}
          lots={lots}
          show={showLots}
          editControl={editor ? <a href={`/series/${series.slug}/manage/lots/new`} className="srs-btn is-ghost is-small">+ Add artwork</a> : undefined}
        />
        <SrsJournal entries={journal} />
        <SrsArticles weeks={weeks} editControl={role ? <AddArticleButton series={series} role={role} defaultWeek={week} /> : undefined} />
        <SrsDiscussion
          slug={series.slug}
          signedIn={Boolean(userId)}
          viewerName={viewer?.displayName ?? null}
          published={series.status === "published"}
          forumHref={discussion ? `${FORUM_URL}/t/${discussion.threadId}/${discussion.threadSlug}` : null}
          replies={discussion?.replies ?? []}
          replyCount={discussion?.replyCount ?? 0}
          following={follow.following}
          followerCount={follow.count}
        />
      </main>
      <SrsFooter series={series} partners={partners} />
    </div>
  );
}
