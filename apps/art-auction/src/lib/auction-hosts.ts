import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * The two organisations the auction is presented under: IFAC runs it,
 * Arts Collective (the platform) hosts it. Their names, pictures and bios are the
 * network profile rows (`users`, one per organisation, slug = org id), so
 * editing the profile changes the auction page too.
 */
export type AuctionHost = {
  slug: "ifac" | "elkdonis";
  name: string;
  /** What the organisation does for the auction, in a few words. */
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  /** The organisation's own site. */
  url: string;
};

type Row = { slug: string; display_name: string | null; avatar_url: string | null; bio: string | null };

const FALLBACK_NAME = {
  ifac: "International Fine Art Collectors",
  elkdonis: "Arts Collective",
} as const;

const NETWORK = {
  ifac: process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008",
  elkdonis: siteConfig.network.artsCollectiveUrl,
} as const;

export async function getAuctionHosts(): Promise<{ presenter: AuctionHost; host: AuctionHost }> {
  let rows: Row[] = [];
  try {
    rows = await db<Row[]>`
      SELECT COALESCE(o.id, u.slug) AS slug, u.display_name, u.avatar_url, u.bio
      FROM organizations o
      JOIN users u ON u.id = o.profile_user_id
      WHERE o.id IN ('ifac', 'elkdonis')
    `;
  } catch (err) {
    // The page must still render its heading if the profile lookup fails.
    console.error("[auction-hosts] profile lookup failed:", err);
  }
  // The host is the Arts Collective platform = org `elkdonis` (renamed
  // 2026-10-28), stewarded by the not-for-profit `inner_group`.
  const by = (slug: "ifac" | "elkdonis"): AuctionHost => {
    const r = rows.find((x) => x.slug === slug);
    return {
      slug,
      name: r?.display_name || FALLBACK_NAME[slug],
      role: slug === "ifac" ? "Presents the auction" : "Hosts the auction",
      avatarUrl: r?.avatar_url || null,
      bio: r?.bio || null,
      url: NETWORK[slug],
    };
  };
  return { presenter: by("ifac"), host: by("elkdonis") };
}

/** Profile pictures are stored full size; ask the media route for a card-sized copy. */
export function avatarSrc(url: string, width: number): string {
  return url.includes("/api/media/") && !url.includes("?") ? `${url}?w=${width}` : url;
}
