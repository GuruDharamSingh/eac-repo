import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getThreadsForFeed } from "@/lib/data";
import { ThreadCard } from "@/components/thread-card";

interface Props { params: Promise<{ feed: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const feed = await getOrgFeed(siteConfig.orgId, (await params).feed).catch(() => null);
  return { title: feed?.name ?? "Not found" };
}

/**
 * A section of the site, straight from org_feeds — adding one is a row, not a
 * route. Static pages (/books, /groups, …) win over this by Next's own rules.
 */
export default async function FeedPage({ params }: Props) {
  const { feed: slug } = await params;
  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, slug).catch(() => null),
    getViewer().catch(() => null),
  ]);
  // isPublic is only "show in the nav"; minRole is the gate.
  if (!feed || !canViewFeed(feed, viewer?.role ?? null)) notFound();

  const threads = await getThreadsForFeed(slug);
  return (
    <div className="column band">
      <p className="eyebrow">{feed.presenter ?? siteConfig.orgName}</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>{feed.name}</h1>
      {feed.tagline && <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>{feed.tagline}</p>}
      <div style={{ display: "grid", gap: 16, marginTop: 24, maxWidth: 720 }}>
        {threads.length === 0 ? <div className="empty">Nothing here yet.</div> : threads.map((t) => <ThreadCard key={t.id} thread={t} />)}
      </div>
    </div>
  );
}
