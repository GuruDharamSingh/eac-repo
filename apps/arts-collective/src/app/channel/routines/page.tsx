import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { Routines } from "@/components/channel/Routines";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/** Routines (the planner): edit, stop and add routines; this week's slots. */
export default async function ChannelRoutinesPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = `/channel/routines${params.org ? `?org=${encodeURIComponent(params.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const model = await loadChannelModel(user, { org: params.org });
  return (
    <ChannelFrame model={model} active="routines">
      <Routines />
    </ChannelFrame>
  );
}
