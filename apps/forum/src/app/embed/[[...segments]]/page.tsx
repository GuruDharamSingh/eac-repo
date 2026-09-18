import { notFound } from "next/navigation";
import { renderForumRoute } from "@elkdonis/forum-ui";
import { getBoardBySlug } from "@elkdonis/services";
import { getConnectors } from "@/lib/connectors";
import { getViewer } from "@/lib/viewer";

/**
 * /embed/…: the forum with no chrome, for an <iframe>. See embed/layout.tsx.
 *
 * /embed/o/[org]/… is served in ORG scope — the same scope an org's own site
 * mounts the package in — so the rail shows that org's categories alone and
 * every link stays under /embed/o/[org]. Anything else is the network in a
 * frame, under /embed.
 */

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EmbedRoute({ params, searchParams }: Props) {
  const [{ segments = [] }, sp] = await Promise.all([params, searchParams]);

  if (segments[0] === "o" && segments[1]) {
    const board = await getBoardBySlug(segments[1], await getViewer());
    if (!board) notFound();
    const connectors = await getConnectors({ base: `/embed/o/${board.slug}`, org: { orgId: board.orgId, name: board.name } });
    return renderForumRoute({ connectors, segments: segments.slice(2), searchParams: sp });
  }

  const connectors = await getConnectors({ base: "/embed" });
  return renderForumRoute({ connectors, segments, searchParams: sp });
}
