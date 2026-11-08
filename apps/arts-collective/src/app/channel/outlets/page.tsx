import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { Outlets } from "@/components/channel/Outlets";
import { OUTLET_TABS, type OutletTab } from "@/components/channel/outlet-tabs";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string; tab?: string }> };

/** Outlets: one tab per place work goes (accounts, Connect, planned, gaps, history). */
export default async function ChannelOutletsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: OutletTab = (OUTLET_TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as OutletTab) : "instagram";
  const q = new URLSearchParams({ tab });
  if (params.org) q.set("org", params.org);
  const user = await requireUser(`/login?next=${encodeURIComponent(`/channel/outlets?${q}`)}`);
  const model = await loadChannelModel(user, { org: params.org });
  return (
    <ChannelFrame model={model} active="outlets" outletTab={tab}>
      <Outlets tab={tab} />
    </ChannelFrame>
  );
}
