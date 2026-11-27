import { listChannelCommentPosts, listCommentConnections } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { Comments } from "@/components/channel/Comments";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/**
 * Comments (2026-11-24): comments on the posts this person sent to Facebook
 * and Instagram through their own connections, with replies as the Page or
 * account. In an org's channel, only the posts filed under that org.
 */
export default async function ChannelCommentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = `/channel/comments${params.org ? `?org=${encodeURIComponent(params.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const model = await loadChannelModel(user, { org: params.org });
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const [posts, connections] = await Promise.all([
    listChannelCommentPosts(user.id, { orgId: scopeOrg }),
    listCommentConnections(user.id),
  ]);
  return (
    <ChannelFrame model={model} active="comments">
      <Comments posts={posts} connections={connections} scopeOrg={scopeOrg} />
    </ChannelFrame>
  );
}
