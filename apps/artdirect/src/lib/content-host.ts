import type { ContentHost } from "@elkdonis/content/host";
import { getCurrentUser } from "@/lib/session";

/**
 * ArtDirect as a content-library host (CONTRACT §6, v1.3 §15), 2026-11-26.
 *
 * Used by the directory index (app/page.tsx), which searches the people view.
 * ArtDirect serves a person's page at `/<slug>` on its own host, so the person
 * link is relative. Pieces are not listed here yet, so `piece` and `studio`
 * answer null; `siteHome` leaves org sites to the server (org_domains).
 */
export const contentHost: ContentHost = {
  viewer: async () => {
    const user = await getCurrentUser().catch(() => null);
    return user ? { userId: user.id } : null;
  },
  site: {
    orgId: "oad",
    name: "ArtDirect",
    domain: (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    timeZone: process.env.CHANNEL_TIME_ZONE ?? "America/Toronto",
  },
  urls: {
    piece: () => null,
    studio: () => null,
    siteHome: () => null,
    person: (p) => `/${encodeURIComponent(p.slug)}`,
  },
  actions: [],
};
