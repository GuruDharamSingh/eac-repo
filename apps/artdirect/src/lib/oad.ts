import {
  getProfileBySlug,
  listPublicProfiles,
  listProfileGeoFacets,
  hasVouched as hasVouchedFor,
  getAuthoredThreads,
  getAuthoredMedia,
  listProfileOrgs,
  listOrgHomes,
  listUserGalleries,
  WRITING_KIND,
  SCHEDULED_KINDS,
  type Profile,
  type ProfileListItem,
  type EntityType,
  type AuthoredThread,
  type OrgHome,
} from "@elkdonis/services";
import { getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { db } from "@elkdonis/db";
import type {
  DossierProfileData,
  DossierOperation,
  DossierChannel,
  DossierService,
  DossierDispatch,
  DossierMovement,
  DossierExhibit,
  DossierStorefront,
  DossierActivity,
  DossierSections,
} from "@elkdonis/cms-bindings/dossier";
import { DOSSIER_SECTION_KEYS, dossierFieldRegistry } from "@elkdonis/cms-bindings/dossier";

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";
const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";
const IFAC_URL = process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008";

/** The kinds that make up a person's writing. */
const DISPATCH_KINDS = ["post", WRITING_KIND] as const;

/**
 * ArtDirect / Online Artist Directory (OAD) data layer.
 *
 * Backed by users + org_profiles (migration 084/086) rather than
 * directory_profiles. Every principal has a global slug — it is the profile
 * URL and the Nextcloud folder name — so listing is gated separately on
 * users.directory_listed (migration 100). That split is what lets sentinel
 * and system accounts hold a stable slug without appearing here. A slug
 * itself may have come from signup, from opening an unclaimed file on
 * ArtDirect, or from being published on any org's own site (IFAC,
 * amrit_canada, ...). See packages/services/src/profiles.ts for the full
 * model — this is the org-agnostic global directory view of it, rendered
 * through the "Classified Artist Dossier" template via @elkdonis/cms-bindings.
 */

function bioToString(bio: string | null): string | null {
  return bio;
}

function asOperations(dossier: Record<string, unknown>, portfolio: Profile["portfolio"]): DossierOperation[] {
  const ops = dossier.operations;
  if (Array.isArray(ops) && ops.length > 0) {
    return ops
      .map((o): DossierOperation | null =>
        o && typeof o === "object"
          ? {
              title: String((o as { title?: unknown }).title ?? ""),
              date: (o as { date?: string | null }).date ?? null,
              details: (o as { details?: string | null }).details ?? null,
              image_url: (o as { image_url?: string | null }).image_url ?? null,
            }
          : null
      )
      .filter((o): o is DossierOperation => o !== null && Boolean(o.title));
  }
  // Reuse: the plain portfolio [{url,title}] becomes operations when no
  // dossier-specific operations were written.
  return portfolio
    .map((w): DossierOperation | null => (w.title ? { title: w.title, image_url: w.url || null } : null))
    .filter((o): o is DossierOperation => o !== null);
}

/**
 * Hosts and words that mean "this link is where you give me money".
 *
 * The split exists because v0.1 had ONE bucket. Every `social_links` entry was
 * rendered under the heading FINANCIAL CHANNELS with the template's own copy
 * reading "COVERT FUNDING (PATREON)", so on the live directory E.J. Gold's
 * page presented ejgold.com, Facebook, YouTube and Pinterest as ways to send
 * him money. A website is a known address; a shop is not.
 *
 * Matching is deliberately generous on the money side and the fallback is
 * "address": mistaking a shop for a homepage costs a link in the wrong list,
 * while mistaking a homepage for a shop puts a false claim about money on
 * someone's profile.
 */
const MONEY_HOSTS = [
  "patreon.", "ko-fi.", "kofi.", "buymeacoffee.", "gumroad.", "etsy.",
  "ebay.", "shopify.", "bigcartel.", "society6.", "redbubble.", "saatchiart.",
  "paypal.", "venmo.", "gofundme.", "liberapay.", "opencollective.",
  "bandcamp.", "teespring.", "threadless.", "inprnt.", "fineartamerica.",
  "artfinder.", "amazon.",
];

const MONEY_WORDS =
  /\b(shop|store|buy|purchase|support|donate|donation|patron|patronage|commission|commissions|print|prints|merch|tip|tips|sponsor)\b/i;

function isMoneyLink(link: { label?: string | null; url: string }): boolean {
  const url = link.url.toLowerCase();
  if (MONEY_HOSTS.some((h) => url.includes(h))) return true;
  return MONEY_WORDS.test(link.label ?? "");
}

function jsonChannels(value: unknown): DossierChannel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c): DossierChannel | null =>
      c && typeof c === "object" && "url" in c
        ? {
            title: String((c as { title?: unknown }).title ?? ""),
            description: (c as { description?: string | null }).description ?? null,
            url: String((c as { url: unknown }).url),
          }
        : null
    )
    .filter((c): c is DossierChannel => c !== null && Boolean(c.url));
}

/** Money links: whatever they wrote explicitly, plus the shops among their links. */
function asFinancialChannels(
  dossier: Record<string, unknown>,
  socialLinks: Profile["socialLinks"]
): DossierChannel[] {
  const explicit = jsonChannels(dossier.financial_channels);
  const inferred = socialLinks
    .filter(isMoneyLink)
    .map((l) => ({ title: l.label ?? "", url: l.url }));
  const seen = new Set(explicit.map((c) => c.url));
  return [...explicit, ...inferred.filter((c) => !seen.has(c.url))];
}

/** Everything else they linked: the homepage, the socials, the portfolio. */
function asAddressChannels(
  profile: Profile,
  financial: DossierChannel[]
): DossierChannel[] {
  const spent = new Set(financial.map((c) => c.url));
  const out = profile.socialLinks
    .filter((l) => !spent.has(l.url))
    // An email belongs on the contact button, not in a list of addresses.
    .filter((l) => !l.url.toLowerCase().startsWith("mailto:"))
    .map((l) => ({ title: l.label ?? "", url: l.url }));
  if (profile.portfolioUrl && !spent.has(profile.portfolioUrl) && !out.some((c) => c.url === profile.portfolioUrl)) {
    out.unshift({ title: "Portfolio", url: profile.portfolioUrl });
  }
  return out;
}

function asWorkHistory(dossier: Record<string, unknown>): DossierService[] {
  const raw = dossier.work_history;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e): DossierService | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const role = String(o.role ?? "").trim();
      if (!role) return null;
      return {
        role,
        organisation: (o.organisation ?? o.organization ?? null) as string | null,
        from: (o.from ?? null) as string | null,
        to: (o.to ?? null) as string | null,
        detail: (o.detail ?? null) as string | null,
      };
    })
    .filter((e): e is DossierService => e !== null);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function contactHref(profile: Profile): string | null {
  const email = profile.socialLinks.find((l) => l.label === "Email" && l.url.startsWith("mailto:"));
  if (email) return email.url;
  const website = profile.socialLinks.find((l) => l.label === "Website");
  return website?.url ?? null;
}

/** Which optional sections this person has switched on. */
function asSections(value: unknown): DossierSections {
  const out: DossierSections = {};
  if (!value || typeof value !== "object") return out;
  const bag = value as Record<string, unknown>;
  for (const key of DOSSIER_SECTION_KEYS) out[key] = bag[key] === true;
  return out;
}

// ─── where a thing lives ─────────────────────────────────────────────────────

/**
 * Where each org's site is: its verified custom domain, else its page on the
 * network. A dossier links OUT to the thing itself, so a dispatch has to
 * resolve to the org that published it rather than to ArtDirect.
 */
function orgBase(homes: OrgHome[]): Map<string, string> {
  return new Map(
    homes.map((h) => [
      h.orgId,
      h.primaryDomain ? `https://${h.primaryDomain}` : `${NETWORK_URL}/sites/${h.orgSlug}`,
    ])
  );
}

function threadHref(base: Map<string, string>, t: AuthoredThread): string {
  const home = base.get(t.orgId) ?? NETWORK_URL;
  return `${home}/${t.section ?? "posts"}/${t.slug}`;
}

// ─── the content the file now carries ────────────────────────────────────────

export type DossierContentOptions = {
  /** The signed-in user. Their own drafts appear only when this matches. */
  viewerId?: string;
};

/**
 * Everything on a dossier that is not the identity block.
 *
 * Every read here is independently `.catch`ed by the service it calls, and the
 * whole set runs in parallel: a person's file should not 500 because their
 * marketplace store is mid-migration. A section that cannot load renders as
 * absent, which on a dossier is legible in a way an error page is not.
 */
async function loadDossierContent(
  profile: Profile,
  opts: DossierContentOptions = {}
): Promise<
  Pick<
    DossierProfileData,
    "dispatches" | "movements" | "exhibits" | "storefront" | "activity"
  >
> {
  const userId = profile.userId;
  const isSelf = Boolean(opts.viewerId && opts.viewerId === userId);
  const sections = asSections(profile.profileSections);

  const [writing, events, galleries, showcase, orgs, media, homes] = await Promise.all([
    getAuthoredThreads(userId, {
      kinds: DISPATCH_KINDS,
      viewerId: opts.viewerId,
      limit: 12,
    }),
    getAuthoredThreads(userId, {
      kinds: SCHEDULED_KINDS,
      scheduledOnly: true,
      order: "scheduled",
      viewerId: opts.viewerId,
      limit: 12,
    }),
    listUserGalleries(userId, { onlyPublic: !isSelf }).catch(() => []),
    sections.store
      ? getStoreShowcaseForUser(userId, { limit: 6 }).catch(() => null)
      : Promise.resolve(null),
    listProfileOrgs(userId, { onlyPublic: true }).catch(() => []),
    getAuthoredMedia(userId, { limit: 200 }).catch(() => []),
    listOrgHomes().catch(() => [] as OrgHome[]),
  ]);

  const base = orgBase(homes);

  const dispatches: DossierDispatch[] = writing.map((t) => ({
    id: t.id,
    title: t.title,
    href: threadHref(base, t),
    excerpt: t.excerpt,
    coverImageUrl: t.coverImageUrl,
    publishedAt: t.publishedAt,
    orgName: t.orgName,
    kind: t.kind,
    draft: t.status !== "published",
  }));

  const movements: DossierMovement[] = events
    .filter((t) => Boolean(t.scheduledAt))
    .map((t) => ({
      id: t.id,
      title: t.title,
      href: threadHref(base, t),
      scheduledAt: String(t.scheduledAt),
      durationMinutes: t.durationMinutes,
      location: t.location,
      orgName: t.orgName,
      kind: t.kind,
    }));

  // Gallery pages are served by IFAC today — the only app that has ever had a
  // route for them. Pointing at the app that can actually render one beats
  // linking to a 404 on this one.
  const gallerySlug = profile.slug ?? profile.userId;
  const exhibits: DossierExhibit[] = galleries.map((g) => ({
    id: g.id,
    title: g.title,
    href: `${IFAC_URL}/artists/${gallerySlug}/galleries/${g.slug}`,
    description: g.description,
    coverUrl: g.coverUrl,
    itemCount: g.itemCount,
  }));

  const storefront: DossierStorefront | null = showcase
    ? {
        name: showcase.store.displayName || "Store",
        href: `${MARKETPLACE_URL}/artists/${showcase.store.slug ?? showcase.store.id}`,
        lots: showcase.artworks.map((a) => {
          const variant = a.variants?.[0];
          return {
            id: a.id,
            title: a.title,
            href: `${MARKETPLACE_URL}/artworks/${a.id}`,
            imageUrl: a.primaryImageUrl ?? null,
            price:
              variant && variant.priceMinor > 0
                ? formatMoney(variant.priceMinor, variant.currency)
                : null,
            status: a.status,
          };
        }),
      }
    : null;

  // Filings are grouped under the org they were published on. An org the
  // person holds a public profile on but has filed nothing to still appears —
  // absence is information on a dossier.
  const filed = await getAuthoredThreads(userId, { viewerId: opts.viewerId, limit: 60 });
  const byOrg = new Map<string, AuthoredThread[]>();
  for (const t of filed) {
    const list = byOrg.get(t.orgId) ?? [];
    list.push(t);
    byOrg.set(t.orgId, list);
  }
  const known = new Set(orgs.map((o) => o.orgId));
  const orgIds = [...orgs.map((o) => o.orgId), ...[...byOrg.keys()].filter((id) => !known.has(id))];

  const activity: DossierActivity | null =
    orgIds.length === 0
      ? null
      : {
          orgs: orgIds.map((orgId) => {
            const profileOrg = orgs.find((o) => o.orgId === orgId);
            const filings = byOrg.get(orgId) ?? [];
            return {
              orgId,
              orgName: profileOrg?.orgName ?? filings[0]?.orgName ?? orgId,
              href: base.get(orgId) ?? null,
              roleTitle: profileOrg?.roleTitle ?? null,
              filings: filings.slice(0, 8).map((t) => ({
                id: t.id,
                title: t.title,
                href: threadHref(base, t),
                date: t.publishedAt,
                draft: t.status !== "published",
              })),
            };
          }),
          filingCount: filed.length,
          mediaCount: media.length,
        };

  return { dispatches, movements, exhibits, storefront, activity };
}

function profileToDossier(profile: Profile): DossierProfileData {
  const d = profile.oadDossier;
  const financial = asFinancialChannels(d, profile.socialLinks);
  return {
    slug: profile.slug ?? profile.userId,
    name: profile.displayName,
    occupation: profile.headline,
    location: (d.location as string | undefined) ?? ([profile.city, profile.region].filter(Boolean).join(", ") || null),
    dossier_status: (d.dossier_status as string | undefined) ?? null,
    bio: profile.bio,
    photo_url: profile.avatarUrl,
    operations: asOperations(d, profile.portfolio),
    current_targets: asStringArray(d.current_targets),
    projected_movements: asStringArray(d.projected_movements),
    verified_contacts: asStringArray(d.verified_contacts),
    wanted_accomplices: asStringArray(d.wanted_accomplices),
    financial_channels: financial,
    channels: asAddressChannels(profile, financial),
    work_history: asWorkHistory(d),
    // Filled by loadDossierContent. Empty here so a caller that only wants the
    // identity block (a card, a preview, a meta description) pays for nothing.
    dispatches: [],
    movements: [],
    exhibits: [],
    storefront: null,
    activity: null,
    claim_status: profile.claimStatus,
    verified: profile.verified,
    contact_href: contactHref(profile),
    sections: asSections(profile.profileSections),
  };
}

/**
 * The identity half of a dossier. Cheap: one profile read, no network content.
 */
export async function getDossierProfile(slug: string): Promise<DossierProfileData | null> {
  const profile = await getProfileBySlug(slug);
  return profile ? profileToDossier(profile) : null;
}

/**
 * The whole file: identity plus everything they have published.
 *
 * Separate from `getDossierProfile` so the pages that only need a name and a
 * portrait — the index, the metadata, a card — do not run eight queries.
 */
export async function getFullDossier(
  slug: string,
  opts: DossierContentOptions = {}
): Promise<DossierProfileData | null> {
  const profile = await getProfileBySlug(slug);
  if (!profile) return null;
  const base = profileToDossier(profile);
  const content = await loadDossierContent(profile, opts);
  return { ...base, ...content };
}

export type DossierListItem = {
  slug: string;
  name: string;
  occupation: string | null;
  location: string | null;
  region: string | null;
  country: string | null;
  portrait_url: string | null;
  claim_status: "unclaimed" | "pending" | "claimed";
  verified: boolean;
  vouch_count: number;
  entity_type: EntityType;
};

function toListItem(p: ProfileListItem): DossierListItem {
  return {
    slug: p.slug ?? p.userId,
    name: p.displayName,
    occupation: p.headline,
    location: (p.oadDossier.location as string | undefined) ?? null,
    region: p.region,
    country: p.country,
    portrait_url: p.avatarUrl,
    claim_status: p.claimStatus,
    verified: p.verified,
    vouch_count: p.vouchCount,
    entity_type: p.entityType,
  };
}

export async function listDossiers(
  opts: { region?: string; entityType?: EntityType; limit?: number } = {}
): Promise<DossierListItem[]> {
  const rows = await listPublicProfiles(opts);
  return rows.map(toListItem);
}

export type DirectoryFacets = { cities: string[]; regions: string[]; countries: string[] };

export async function listDirectoryFacets(): Promise<DirectoryFacets> {
  return listProfileGeoFacets();
}

/** Distinct regions with dossier counts — for hub indexes / analytics. */
export async function listRegions(): Promise<{ region: string; country: string | null; count: number }[]> {
  try {
    return await db<{ region: string; country: string | null; count: number }[]>`
      SELECT region, MAX(country) AS country, COUNT(*)::int AS count
      FROM users
      WHERE slug IS NOT NULL AND region IS NOT NULL AND region <> ''
      GROUP BY region
      ORDER BY count DESC, region ASC
    `;
  } catch {
    return [];
  }
}

/**
 * Dossiers in a region — the API any community hub uses to surface
 * "artists in your region". Reusable across orgs/geographies.
 */
export async function getDossiersByRegion(region: string, limit = 12): Promise<DossierListItem[]> {
  return listDossiers({ region, limit });
}

export async function listDossierSlugs(): Promise<string[]> {
  try {
    const rows = await db<{ slug: string }[]>`SELECT slug FROM users WHERE slug IS NOT NULL`;
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

// ─── wiki state: meta, vouches, stewardship ──────────────────────────────────

export type DossierMeta = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  claim_status: "unclaimed" | "pending" | "claimed";
  claimed_by: string | null;
  verified: boolean;
  vouch_count: number;
  city: string | null;
  region: string | null;
  country: string | null;
};

export async function getDossierMeta(slug: string): Promise<DossierMeta | null> {
  const profile = await getProfileBySlug(slug);
  if (!profile) return null;
  const [row] = await db<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM profile_vouches WHERE subject_id = ${profile.userId}
  `.catch(() => [{ n: 0 }]);
  return {
    id: profile.userId,
    slug: profile.slug ?? profile.userId,
    name: profile.displayName,
    created_by: profile.createdBy,
    claim_status: profile.claimStatus,
    claimed_by: profile.claimedBy,
    verified: profile.verified,
    vouch_count: row?.n ?? 0,
    city: profile.city,
    region: profile.region,
    country: profile.country,
  };
}

export type DossierEditFields = {
  slug: string;
  name: string;
  occupation: string;
  city: string;
  region: string;
  country: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  location: string;
  bioText: string;
  portrait_url: string;
  website: string;
  email: string;
  linksText: string;
  source_note: string;
};

/** Raw editable values for the contribute/edit form (DB shape, not render shape). */
export async function getDossierEditFields(slug: string): Promise<DossierEditFields | null> {
  const p = await getProfileBySlug(slug);
  if (!p) return null;

  const email = p.socialLinks.find((l) => l.label === "Email" && l.url.startsWith("mailto:"));
  const website = p.socialLinks.find((l) => l.label === "Website");
  const otherLinks = p.socialLinks.filter((l) => l !== email && l !== website);

  return {
    slug: p.slug ?? p.userId,
    name: p.displayName,
    occupation: p.headline ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    country: p.country ?? "",
    postcode: p.postalCode ?? "",
    lat: p.lat,
    lng: p.lng,
    location: (p.oadDossier.location as string | undefined) ?? "",
    bioText: p.bio ?? "",
    portrait_url: p.avatarUrl ?? "",
    website: website?.url ?? "",
    email: email ? email.url.slice("mailto:".length) : "",
    linksText: otherLinks.map((l) => `${l.label ?? ""} | ${l.url}`).join("\n"),
    source_note: p.sourceNote ?? "",
  };
}

export async function hasVouched(subjectUserId: string, voucherId: string): Promise<boolean> {
  return hasVouchedFor(subjectUserId, voucherId);
}

/**
 * A user is an OAD "steward" (can verify / edit any dossier) if they own or
 * admin the collective hub org, or are a global admin.
 */
export async function isOadSteward(userId: string): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      WITH candidate_users AS (
        SELECT ${userId}::text AS id
        UNION
        SELECT id::text FROM users WHERE auth_user_id = ${userId}
      )
      SELECT uo.role
      FROM user_organizations uo
      WHERE uo.user_id::text IN (SELECT id FROM candidate_users)
        AND uo.org_id = 'elkdonis'
        AND uo.role IN ('owner', 'admin')
      LIMIT 1
    `;
    if (rows.length > 0) return true;
    const [admin] = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`;
    return admin?.is_admin ?? false;
  } catch {
    return false;
  }
}

// ─── what the owner's sidebar needs ──────────────────────────────────────────

/** A dossier field's current value, by trait. */
export type DossierEditValues = Record<string, string | string[] | Record<string, unknown>[]>;

/**
 * `users` columns a dossier field may read, by column name.
 *
 * The mirror of COLUMN_SETTERS in dossier-editor-actions. Both are explicit
 * maps rather than computed property access, so the registry — which ships in
 * a package — can never name its way into a column nobody meant to expose.
 */
const COLUMN_READERS: Record<string, (p: Profile) => DossierEditValues[string]> = {
  display_name: (p) => p.displayName ?? "",
  headline: (p) => p.headline ?? "",
  bio: (p) => p.bio ?? "",
  avatar_url: (p) => p.avatarUrl ?? "",
  social_links: (p) => p.socialLinks.map((l) => ({ label: l.label ?? "", url: l.url })),
};

/**
 * Current values for every editable dossier field.
 *
 * Derived from the profile the page already read, so opening the sidebar costs
 * no extra queries. Built by walking `dossierFieldRegistry` rather than by
 * listing the fields again here — a field added to the registry appears in the
 * sidebar already filled in, instead of appearing empty until someone
 * remembers to add it in a second place.
 */
export function dossierEditValues(profile: Profile): DossierEditValues {
  const out: DossierEditValues = {};

  for (const [trait, field] of Object.entries(dossierFieldRegistry)) {
    if (field.json) {
      const raw = profile.oadDossier[field.col];
      if (field.list) {
        out[trait] = asStringArray(raw);
      } else if (field.input === "compound") {
        out[trait] = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
      } else {
        out[trait] = typeof raw === "string" ? raw : "";
      }
      continue;
    }
    const read = COLUMN_READERS[field.col];
    out[trait] = read ? read(profile) : "";
  }

  // The work list falls back to the plain account portfolio when nothing
  // dossier-specific has been written — the same fallback the renderer makes.
  // Showing it here is what stops someone "fixing" an empty-looking field by
  // retyping work their page is already displaying.
  const work = out.operationsList;
  if (Array.isArray(work) && work.length === 0 && profile.portfolio.length > 0) {
    out.operationsList = profile.portfolio
      .filter((w) => w.title)
      .map((w) => ({ title: w.title as string, image_url: w.url ?? "" }));
  }

  return out;
}
