export const siteConfig = {
  name: "Art-Auction",
  shortName: "Art-Auction",
  tagline: "Original artwork from independent artists. Bid, buy, collect.",
  description:
    "Art-Auction is the Elkdonis Arts Collective marketplace for original paintings, prints, and sculpture. Buy outright or bid in timed auctions; pay by card or Interac eTransfer, and the artist is paid directly.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3009",
  /**
   * The organisation whose marketplace this site is. A person's store and an
   * org's store both trade in it (store.org_id); who takes the revenue is a
   * separate fact (store.owner_*).
   */
  marketplaceOrgId: "market",
  defaultCurrency: "CAD" as const,
  reservationMinutes: 15,
  etransferDueHours: 72,
  /** The other two centralising sites: profiles and org hubs. */
  network: {
    artdirectUrl: process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013",
    artsCollectiveUrl:
      process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007",
  },
} as const;

export type SiteConfig = typeof siteConfig;
