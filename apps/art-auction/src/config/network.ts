import { siteConfig } from "./site";

/**
 * The other apps in the network that hand a member over to the marketplace.
 *
 * Art-Auction is a centralised app: it is the headquarters of selling across
 * the collective, and it is also a service IFAC, Amrit Canada, ArtDirect and
 * the org sites send people into. Someone who pressed "Open a store" on IFAC
 * arrived here with no way back and no sign that they had left — the trip
 * looked like a dead end rather than an errand. `?from=` names the app they
 * came from; this is the one place that turns that id into somewhere to
 * return to.
 *
 * Unknown ids are ignored rather than trusted: `from` arrives in a URL, so it
 * must never be able to put an arbitrary destination behind a "Back to…" link.
 */
export interface NetworkApp {
  id: string;
  name: string;
  url: string;
  /** Where in that app the member most likely came from. */
  homePath: string;
}

const APPS: NetworkApp[] = [
  {
    id: "ifac",
    name: "IFAC",
    url: process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008",
    homePath: "/hub",
  },
  {
    id: "artdirect",
    name: "ArtDirect",
    url: siteConfig.network.artdirectUrl,
    homePath: "/",
  },
  {
    id: "arts_collective",
    name: "the Arts Collective",
    url: siteConfig.network.artsCollectiveUrl,
    homePath: "/hub",
  },
  {
    id: "amrit_canada",
    name: "Amrit Canada",
    url: process.env.NEXT_PUBLIC_AMRIT_CANADA_URL ?? "http://localhost:3006",
    homePath: "/hub",
  },
  {
    id: "innergathering",
    name: "Inner Gathering",
    url: process.env.NEXT_PUBLIC_INNERGATHERING_URL ?? "http://localhost:3015",
    homePath: "/center",
  },
];

const BY_ID = new Map(APPS.map((a) => [a.id, a]));

/** Resolve a `?from=` value to a known app, or null. Never trusts the input. */
export function resolveNetworkApp(from: string | null | undefined): NetworkApp | null {
  if (!from) return null;
  return BY_ID.get(from.trim().toLowerCase()) ?? null;
}

/** Absolute URL back to where the member came from. */
export function returnUrl(app: NetworkApp): string {
  return `${app.url.replace(/\/+$/, "")}${app.homePath}`;
}

/** Cookie that remembers the referring app across the errand. */
export const FROM_COOKIE = "ea_market_from";
