import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { canCreateSeries } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// The About page's content (2026-10-28): sections with a header, a kicker,
// rich text, an optional media piece beside the text, and a link, stored in
// `site_config` (org `market`, key `about_page`) and edited in place by the
// site's owners. The copy is Collect Art's own description of each
// organisation, not the organisation's official profile bio. Until the page
// is first saved, the defaults below are shown.
// ============================================================================

export interface AboutSection {
  id: string;
  kicker: string | null;
  title: string;
  html: string;
  media: { url: string; kind: "image" | "video"; alt?: string } | null;
  link: { url: string; label: string } | null;
}

export interface AboutContent {
  lede: string;
  sections: AboutSection[];
}

export const ABOUT_KEY = "about_page";

export const DEFAULT_ABOUT: AboutContent = {
  lede: "What Collect Art is, who presents the auction, and who stands behind the platform.",
  sections: [
    {
      id: "collect-art",
      kicker: null,
      title: "Collect Art",
      html:
        "<p>Collect Art is the marketplace of the Arts Collective platform: the central place for buying and bidding on art from across the network. It has two parts.</p>" +
        "<p>The auction series are occasional, curated auctions with a set run: lots are added over several weeks of silent bidding, and the series closes with a live online auction.</p>" +
        "<p>The Market is always open. Any artist on the network can list work there and sell it outright; some pieces also run an auction of their own.</p>",
      media: null,
      link: null,
    },
    {
      id: "ifac",
      kicker: "Presents the auction series",
      title: "International Fine Art Collectors",
      html:
        "<p>An online gallery and artist community representing independent fine artists and art dealers. IFAC presents the first Collect Art auction series and selects the work offered in it.</p>",
      media: { url: `${process.env.NEXT_PUBLIC_IFAC_URL ?? "https://ifacgroup.com"}/api/media/EAC_Network/ifac/Media/Images/Site/img-banner.jpg`, kind: "image", alt: "IFAC, International Fine Art Collectors" },
      link: { url: process.env.NEXT_PUBLIC_IFAC_URL ?? "https://ifacgroup.com", label: "Visit ifacgroup.com" },
    },
    {
      id: "arts-collective",
      kicker: "Hosts the auction",
      title: "Arts Collective",
      html:
        "<p>Arts Collective (arts-collective.com) is a self-hosted web portal, free to use and run by other artists. Aspiring artists and leaders join it as a mutual aid: subdomain hosting, publishing, email, secure checkout, a group of like-minded people, and micro-grants funded through the mutual aid.</p>" +
        "<p>Its sites share one sign-in, so a collector who signs in here is signed in across the network. Artists keep one profile and can sell, show and run auctions from it.</p>",
      media: null,
      link: { url: siteConfig.network.artsCollectiveUrl, label: "Visit arts-collective.com" },
    },
    {
      id: "elkdonis",
      kicker: "The name",
      title: "Elkdonis",
      html: "",
      media: null,
      link: null,
    },
    {
      id: "elkdonis-arts-collective",
      kicker: "Who stands behind Arts Collective",
      title: "Elkdonis Arts Collective",
      html:
        "<p>Elkdonis Arts Collective is a not-for-profit corporation that brings artists together, helps make art profitable, and creates artist collectives, for social gatherings and the technical trades alike. The Arts Collective platform is operated on its behalf. It is a not-for-profit, not a registered charity.</p>",
      media: null,
      link: { url: process.env.NEXT_PUBLIC_ELKDONIS_ARTS_URL ?? "https://elkdonis-arts.org", label: "Visit elkdonis-arts.org" },
    },
    {
      id: "money",
      kicker: null,
      title: "Where the money goes",
      html:
        "<p>On every sale the artist receives the price less the marketplace commission ({{commission}}) and the card fee when paid by card. A piece may be marked by its artist for a charity, for the Elkdonis Arts Collective, or for the IFAC Gallery; on unmarked pieces the buyer chooses, at checkout, where the site's share goes.</p>" +
        "<p>The Elkdonis Arts Collective is a not-for-profit, not a registered charity, so purchases are not tax-receipted.</p>",
      media: null,
      link: null,
    },
  ],
};

const safeUrl = (u: unknown): string | null => {
  if (typeof u !== "string" || !u) return null;
  return (u.startsWith("/") && !u.startsWith("//")) || /^https?:\/\//i.test(u) ? u.slice(0, 2000) : null;
};

/** Validate and sanitise content from the editor or the database. Unknown keys are dropped. */
export function cleanAbout(raw: unknown): AboutContent {
  const r = (raw ?? {}) as Partial<AboutContent>;
  const sections = Array.isArray(r.sections) ? r.sections : [];
  const seen = new Set<string>();
  return {
    lede: typeof r.lede === "string" ? r.lede.slice(0, 400) : DEFAULT_ABOUT.lede,
    sections: sections
      .map((s, i): AboutSection | null => {
        if (!s || typeof s !== "object") return null;
        const title = typeof s.title === "string" ? s.title.trim().slice(0, 160) : "";
        if (!title) return null;
        let id = typeof s.id === "string" && /^[a-z0-9-]{1,60}$/.test(s.id) ? s.id : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `section-${i + 1}`;
        while (seen.has(id)) id = `${id}-${i + 1}`;
        seen.add(id);
        const mediaUrl = safeUrl((s.media as { url?: unknown } | null)?.url);
        const linkUrl = safeUrl((s.link as { url?: unknown } | null)?.url);
        return {
          id,
          kicker: typeof s.kicker === "string" && s.kicker.trim() ? s.kicker.trim().slice(0, 120) : null,
          title,
          html: typeof s.html === "string" ? sanitizeRichText(s.html).slice(0, 40_000) : "",
          media: mediaUrl ? { url: mediaUrl, kind: (s.media as { kind?: string }).kind === "video" ? "video" : "image", alt: typeof (s.media as { alt?: unknown }).alt === "string" ? String((s.media as { alt?: string }).alt).slice(0, 200) : undefined } : null,
          link: linkUrl ? { url: linkUrl, label: (typeof (s.link as { label?: unknown }).label === "string" && String((s.link as { label?: string }).label).trim()) || "Visit" } : null,
        };
      })
      .filter((s): s is AboutSection => s !== null)
      .slice(0, 20),
  };
}

export async function loadAbout(): Promise<{ content: AboutContent; saved: boolean }> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.marketplaceOrgId} AND key = ${ABOUT_KEY}
    `) as unknown as Array<{ value: unknown }>;
    if (row?.value) return { content: cleanAbout(row.value), saved: true };
  } catch (err) {
    console.error("[about] load:", err);
  }
  return { content: DEFAULT_ABOUT, saved: false };
}

export async function saveAbout(content: AboutContent): Promise<void> {
  const clean = cleanAbout(content);
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${siteConfig.marketplaceOrgId}, ${ABOUT_KEY}, ${db.json(clean as never)}, now())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

/** Who edits the About page: an owner of the marketplace org, or a network admin. */
export async function canEditAbout(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  return canCreateSeries(userId, siteConfig.marketplaceOrgId);
}
