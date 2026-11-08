import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { Queue } from "@/components/channel/Queue";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string; week?: string; view?: string; routines?: string }> };

/** Queue (2a): the week, or five weeks with `?view=month`. */
export default async function ChannelQueuePage({ searchParams }: Props) {
  const params = await searchParams;
  const next = `/channel/queue${params.org ? `?org=${encodeURIComponent(params.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const view = params.view === "month" ? "month" : "week";
  const model = await loadChannelModel(user, { org: params.org, week: params.week, span: view });
  return (
    <ChannelFrame model={model} active="queue">
      <Queue view={view} editRoutines={params.routines === "edit"} />
    </ChannelFrame>
  );
}
