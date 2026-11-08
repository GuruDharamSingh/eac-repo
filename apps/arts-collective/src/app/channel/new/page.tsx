import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { NewPost } from "@/components/channel/NewPost";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string; about?: string }> };

/** New post (1d): `?about=<thread|artwork>:<id>` starts from that piece. */
export default async function ChannelNewPostPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = `/channel/new${params.org ? `?org=${encodeURIComponent(params.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const model = await loadChannelModel(user, { org: params.org });
  const about = params.about && /^(thread|artwork):[A-Za-z0-9_-]{1,64}$/.test(params.about) ? params.about : null;
  return (
    <ChannelFrame model={model} active="new">
      <NewPost about={about} />
    </ChannelFrame>
  );
}
