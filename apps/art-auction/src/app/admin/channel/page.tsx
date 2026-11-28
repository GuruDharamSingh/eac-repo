import type { Metadata } from "next";
import { requireKeeper } from "@/lib/marketplace-auth";
import { getHubCardViewer } from "@/lib/hub-site";
import { ChannelDetail } from "@/components/hub/cards";
import { loadMarketChannel } from "@/lib/market-channel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Channel · Admin" };

/**
 * The Channel card's "Open page" (Content cornerstone Step 4, 2026-11-26): the market's Channel at full size.
 * HubCardMount builds the card's detail link as <hubBase>/<card id> = /admin/channel.
 */
export default async function AdminChannelPage() {
  // Gate in the page as well as the layout (see admin/artworks/page.tsx).
  await requireKeeper();
  const viewer = await getHubCardViewer();
  if (!viewer) return null;
  const data = await loadMarketChannel({ userId: viewer.userId }).catch((err) => {
    console.error("[admin/channel]", err);
    return null;
  });
  if (!data) {
    return (
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">Channel</h2>
        <p className="text-sm text-muted-foreground">
          The market&rsquo;s Channel opens for owners and guides of the market organisation.
        </p>
      </section>
    );
  }
  return (
    <section>
      <ChannelDetail data={data} />
    </section>
  );
}
