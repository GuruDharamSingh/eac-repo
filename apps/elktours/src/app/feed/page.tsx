import type { Metadata } from "next";
import Link from "next/link";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { getOrgFeed } from "@elkdonis/services";
import { Split } from "@/components/mobile/split";
import { getViewer } from "@/lib/auth";
import { loadMobileDoc } from "@/lib/puck/mobile";
import { mobileServerConfig } from "@/lib/puck/config.mobile.server";
import { readMobileFeed } from "@/lib/puck/mobile-places";
import { puckPageMetadata, renderPuckPage } from "@/lib/puck/render";
import { siteConfig } from "@/config/site";
import FeedSectionPage, { generateMetadata as feedSectionMetadata } from "../[feed]/page";

/**
 * /feed (G6, 2026-11-15): the guides' Feed. A static route, so it wins over the [feed] catch-all for this one name.
 * Phone tree: the m-feed document (m-page-title + m-feed-list), rows open the post preview (`?post=`, drawn by
 * components/mobile/overlays.tsx). Desktop tree: exactly what the catch-all drew here before (a section called
 * "feed", else a builder page called "feed"); when neither exists the catch-all would 404, so desktop gets a plain
 * list of the same posts instead.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const section = await getOrgFeed(siteConfig.orgId, "feed").catch(() => null);
  if (section) return feedSectionMetadata({ params: Promise.resolve({ feed: "feed" }) });
  return (await puckPageMetadata("feed")) ?? { title: "Feed", description: "Posts and links the guides want to share." };
}

export default async function FeedPage() {
  const [viewer, feedData, section] = await Promise.all([
    getViewer().catch(() => null),
    readMobileFeed(),
    getOrgFeed(siteConfig.orgId, "feed").catch(() => null),
  ]);

  const { data } = await loadMobileDoc("m-feed");
  const meta = { orgId: siteConfig.orgId, slug: "m-feed", mobileFeed: feedData };
  const filled = await resolveAllData(data, mobileServerConfig, meta);
  const mobile = (
    <>
      <Render config={mobileServerConfig} data={filled as Data} metadata={meta} />
      {viewer?.canEdit && (
        <p style={{ padding: "20px 20px 0" }}>
          <Link href="/studio/m-feed" className="underline underline-offset-4" style={{ fontSize: 13 }}>
            Edit phone layout
          </Link>
        </p>
      )}
    </>
  );

  let desktop: React.ReactNode;
  if (section && section.isPublic) {
    desktop = await FeedSectionPage({ params: Promise.resolve({ feed: "feed" }) });
  } else {
    const page = section ? null : await renderPuckPage("feed");
    desktop = page ?? (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-serif text-4xl">Feed</h1>
        <p className="mt-3 text-muted-foreground">Posts and links the guides want to share.</p>
        {feedData.rows.length === 0 ? (
          <p className="mt-8 border border-dashed border-border p-8 text-center text-muted-foreground">Nothing has been shared yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-border">
            {feedData.rows.map((r) => (
              <li key={r.id} className="py-3">
                <Link href={`/forum/t/${r.id}/topic`} className="font-medium underline-offset-4 hover:underline">{r.title}</Link>
                <p className="text-sm text-muted-foreground">
                  {r.author} · {r.whenLabel}
                  {r.replyCount ? ` · ${r.replyCount} comments` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return <Split mobile={mobile} desktop={desktop} />;
}
