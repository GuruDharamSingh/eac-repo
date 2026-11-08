import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { ChannelHome } from "@/components/channel/Home";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string; view?: string; notice?: string }> };

/** Home (1a) and its coverage matrix (1b, `?view=matrix`). */
export default async function ChannelHomePage({ searchParams }: Props) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.org) q.set("org", params.org);
  if (params.view === "matrix") q.set("view", "matrix");
  const next = `/channel${q.size ? `?${q}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const model = await loadChannelModel(user, { org: params.org, notice: params.notice });
  const view = params.view === "matrix" ? "matrix" : "list";
  return (
    <ChannelFrame model={model} active={view === "matrix" ? "matrix" : "home"}>
      <ChannelHome view={view} />
    </ChannelFrame>
  );
}
