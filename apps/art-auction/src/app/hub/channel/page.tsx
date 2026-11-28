import type { Metadata } from "next";
import { requireKeeper } from "@/lib/marketplace-auth";
import { getHubCardViewer } from "@/lib/hub-site";
import { ChannelDetail } from "@/components/hub/cards";
import { loadMarketChannel } from "@/lib/market-channel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Channel · Hub" };

/** The Channel card's "Open page" under /hub (same as /admin/channel, closing back to /hub). */
export default async function HubChannelPage() {
  await requireKeeper();
  const viewer = await getHubCardViewer();
  if (!viewer) return null;
  const data = await loadMarketChannel({ userId: viewer.userId }).catch((err) => {
    console.error("[hub/channel]", err);
    return null;
  });
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
      {data ? (
        <ChannelDetail data={data} links={{ hubBase: "/hub" }} closeHref="/hub" />
      ) : (
        <p className="text-sm text-muted-foreground">The market&rsquo;s Channel opens for owners and guides of the market organisation.</p>
      )}
    </main>
  );
}
