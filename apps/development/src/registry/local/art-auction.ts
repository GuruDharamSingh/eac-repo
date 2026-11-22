import type { Block } from "@elkdonis/blocks";
import { withSample } from "./util";

/** art-auction: the live auction set and the harvest set. All have their own sample() (lots, bids, stats). */
export async function load(): Promise<Block<never>[]> {
  const [auction, announcement, cardImage, cardTicket, featureList, statBand, timeline] = await Promise.all([
    import("../../../../art-auction/src/blocks/auction-blocks"),
    import("../../../../art-auction/src/blocks/harvest/announcement"),
    import("../../../../art-auction/src/blocks/harvest/card-image"),
    import("../../../../art-auction/src/blocks/harvest/card-ticket"),
    import("../../../../art-auction/src/blocks/harvest/feature-list"),
    import("../../../../art-auction/src/blocks/harvest/stat-band"),
    import("../../../../art-auction/src/blocks/harvest/timeline"),
  ]);
  return [
    auction.lots,
    auction.timeline,
    auction.hero,
    auction.ticker,
    auction.stats,
    auction.countdown,
    announcement.announcement,
    cardImage.cardImage,
    cardTicket.cardTicket,
    featureList.featureList,
    statBand.statBand,
    timeline.timeline,
  ].map((b) => withSample(b));
}
