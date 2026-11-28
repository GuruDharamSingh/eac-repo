import type { Metadata } from "next";
import { requireKeeper } from "@/lib/marketplace-auth";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { CONTENT_SERVERS, artworksServer, type ContentPresetId } from "@/lib/content-cards";
import { ContentCardMount, ContentDetail, ChannelCardMount } from "@/components/hub/cards";
import { loadMarketChannel } from "@/lib/market-channel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content · Admin" };

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; tab?: string }>;
}) {
  // Gate in the page as well as the layout (see admin/artworks/page.tsx): the layout's redirect does not stop this
  // page's data from rendering.
  await requireKeeper();
  const sp = await searchParams;
  const viewer = await getHubCardViewer();
  if (!viewer) return null;

  // "Open page" from a card: the full library for that lens.
  const preset = sp.preset && sp.preset in CONTENT_SERVERS ? (sp.preset as ContentPresetId) : null;
  if (preset) {
    const data = await CONTENT_SERVERS[preset].loadDetail(hubSite, viewer, { tab: sp.tab ?? null });
    return (
      <section>
        <ContentDetail data={data} tab={sp.tab ?? null} />
      </section>
    );
  }

  const [artworks, channel] = await Promise.all([
    artworksServer.load(hubSite, viewer),
    // The market's Channel (Step 4). A Channel outage, or a keeper who does not run the org, costs the card, not the page.
    loadMarketChannel({ userId: viewer.userId }).catch((err) => {
      console.error("[admin/content] channel card:", err);
      return null;
    }),
  ]);
  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">Content</h2>
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">
        Everything published on the market, in one library. Open a card to search it. In an artwork&rsquo;s box a keeper
        can hide it from the public site or show it again (the same as Artworks, one piece at a time).
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <ContentCardMount data={artworks} />
        {channel && <ChannelCardMount data={channel} />}
      </div>
    </section>
  );
}
