export const siteConfig = {
  name: "Art-Auction",
  shortName: "Art-Auction",
  tagline: "Original artwork from independent artists. Bid, buy, collect.",
  description:
    "Art-Auction is a multi-artist marketplace for original paintings, prints, and sculpture. Buy outright or bid in timed auctions; pay artists directly via Interac eTransfer.",
  url:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3009",
  defaultCurrency: "CAD" as const,
  reservationMinutes: 15,
  etransferDueHours: 72,
} as const;

export type SiteConfig = typeof siteConfig;
