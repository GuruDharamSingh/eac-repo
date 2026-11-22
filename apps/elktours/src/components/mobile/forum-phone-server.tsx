import { notFound } from "next/navigation";
import { db } from "@elkdonis/db";
import { getForumThread } from "@elkdonis/services";
import { forumFeedThreads } from "@elkdonis/forum-ui";
import { SurfacePage, threadViewParts } from "@elkdonis/cms-ui/surface";
import { getThreadById } from "@/lib/data";
import { forumHrefs, getForumSnapshot, getForumViewer } from "@/lib/forum";
import { toSurfaceThread } from "@/lib/surface-thread";
import { topicAttachments } from "@/lib/forum-data";
import { siteConfig } from "@/config/site";
import { BackButton } from "./back-button";
import { ForumPhoneHome, ForumPhoneSection } from "./forum-phone";
import { ForumRepliesPanel } from "./forum-replies-panel";

// Server loaders for the phone forum (screens 18, 19, 20). Each returns the phone tree for one /forum route; the page
// puts it beside the untouched forum-ui tree with <Split>. The forum's own rules decide what the viewer sees.

/** Screen 18: /forum. */
export async function ForumHomePhone() {
  const [forum, viewer] = await Promise.all([getForumSnapshot().catch(() => null), getForumViewer()]);
  return <ForumPhoneHome forum={forum} siteName={siteConfig.orgName} canStart={Boolean(viewer.userId)} />;
}

/** Is `slug` one of the sections the viewer can see? Used by the page to decide between the phone section and forum-ui. */
export async function isForumSection(slug: string): Promise<boolean> {
  const f = await getForumSnapshot().catch(() => null);
  return Boolean(f?.feeds.some((x) => x.slug === slug));
}

/** Screen 19: /forum/<section>. */
export async function ForumSectionPhone({ slug }: { slug: string }) {
  const [forum, viewer] = await Promise.all([getForumSnapshot().catch(() => null), getForumViewer()]);
  const feeds = forum?.feeds ?? [];
  const section = feeds.find((f) => f.slug === slug);
  if (!section) notFound();
  const threads = await forumFeedThreads({ scope: { kind: "org", orgId: siteConfig.orgId }, viewer, hrefs: forumHrefs, feedSlug: slug, limit: 40 }).catch(() => []);
  return (
    <ForumPhoneSection
      section={section}
      parent={feeds.find((f) => f.slug === section.parentSlug) ?? null}
      subsections={feeds.filter((f) => f.parentSlug === slug)}
      threads={threads}
      siteName={siteConfig.orgName}
      canStart={Boolean(viewer.userId)}
    />
  );
}

/** Screen 20: /forum/t/[id]/[slug], the thread surface at page size, with its replies and reply bar. */
export async function ForumTopicPhone({ id }: { id: string }) {
  const viewer = await getForumViewer();
  const record = await getForumThread(id, viewer);
  if (!record) notFound();
  const thread = await getThreadById(id);
  if (!thread) notFound();
  const [meta, attachments] = await Promise.all([
    db`SELECT metadata->'link' AS link FROM threads WHERE id = ${id}`.then((r) => (r as unknown as Array<{ link: unknown }>)[0]?.link ?? null).catch(() => null),
    topicAttachments(id),
  ]);
  const base = toSurfaceThread(thread, { feed: { slug: record.feed.slug, name: record.feed.name ?? record.feed.slug }, rsvpCount: 0, viewerAttending: null, cycleStatus: null });
  const link = meta && typeof meta === "object" && typeof (meta as { url?: unknown }).url === "string" ? (meta as NonNullable<typeof base.link>) : null;
  const surfaceThread = { ...base, href: null, link, attachments };
  const parts = threadViewParts(surfaceThread, { timeZone: siteConfig.timeZone }, {});
  return (
    <SurfacePage
      kind={surfaceThread.kind}
      title={surfaceThread.title}
      kicker={parts.kicker}
      crumb={<BackButton href={`/forum/${record.feed.slug}`} />}
    >
      {parts.main}
      <ForumRepliesPanel threadId={id} />
    </SurfacePage>
  );
}
