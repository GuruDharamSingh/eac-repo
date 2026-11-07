// CONTRACT: associated businesses — stewarded shells, facts, claims, removal, place links, connections (migration 242).
/**
 * Network-wide business listings (docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md, with
 * Justin's 2026-11-04 decisions):
 *
 *   - A business is a users row (entity_type = 'organization'). Unowned, it is a SHELL:
 *     claim_status 'unclaimed', listed in the directory (directory_listed = true), always
 *     marked "Unclaimed · listed by <steward>" (BusinessListing.marking).
 *   - Facts live in business_listings, each with its source (facts_source); OSM facts
 *     carry "© OpenStreetMap contributors" (BusinessListing.attributions).
 *   - Stewards: owners of any org (steward_org_id), or platform admins.
 *   - Claims never merge (profiles.approveClaim is NOT used). Approved by platform admins,
 *     or by the steward org's owners for in_person claims. A claimed business stays a
 *     light owned listing (claimed_by_user); adopting it into a tenant org is later.
 *   - Removal: immediate while a shell; 30 days after a claim (removal_due_at).
 *     A removed listing is a tombstone: hidden everywhere, and imports skip its refs.
 *   - Place reviews are not shown on the business page; no vouches, sales or payouts.
 *
 * Source-exported as `@elkdonis/services/businesses` (not through index.ts).
 */
import { db } from '@elkdonis/db';
import { createUnclaimedProfile } from './profiles';

type Row = Record<string, unknown>;

export type BusinessStatus = 'shell' | 'claimed' | 'removed';
export type BusinessWebsiteStatus = 'confirmed' | 'pending_review' | 'none';
export type BusinessClaimMethod = 'domain_email' | 'phone' | 'document' | 'in_person' | 'steward_vouch';
export type BusinessClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type PlaceBusinessRelation = 'operates' | 'hosts' | 'former';

export interface FactSource {
  source: 'osm' | 'wikidata' | 'web' | 'steward' | 'photon';
  ref?: string | null;
  fetchedAt?: string | null;
  attribution?: string | null;
  note?: string | null;
}

export interface BusinessListing {
  userId: string;
  slug: string;
  name: string;
  /** places.operating_kind vocabulary (bakery, cafe, museum, church ...). */
  category: string | null;
  categoryLabel: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  /** Only when confirmed; a pending-review website is never public. */
  website: string | null;
  websiteStatus: BusinessWebsiteStatus;
  /** Steward/admin views: the stored website even when pending review. */
  websiteCandidate: string | null;
  phone: string | null;
  /** OSM opening_hours syntax, as sourced. */
  openingHours: string | null;
  osmRef: string | null;
  wikidataRef: string | null;
  /** Per field: where it came from. */
  factsSource: Record<string, FactSource>;
  /** Licence lines to render with the facts (e.g. "© OpenStreetMap contributors"). */
  attributions: string[];
  photoUrl: string | null;
  photoCredit: string | null;
  status: BusinessStatus;
  steward: { orgId: string; name: string } | null;
  listedBy: { orgId: string; name: string } | null;
  /** "Unclaimed · listed by Elkdonis Tours & Experiences" while a shell; null once claimed. */
  marking: string | null;
  claimedAt: string | null;
  removalDueAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessShellInput {
  name: string;
  category?: string | null;
  streetAddress?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  websiteStatus?: BusinessWebsiteStatus;
  phone?: string | null;
  openingHours?: string | null;
  osmRef?: string | null;
  wikidataRef?: string | null;
  factsSource?: Record<string, FactSource>;
  photoUrl?: string | null;
  photoCredit?: string | null;
}

export interface BusinessFactsPatch extends Partial<BusinessShellInput> {}

export interface PlaceBusinessLink {
  placeId: string;
  relation: PlaceBusinessRelation;
  isPrimary: boolean;
  business: BusinessListing;
}

export interface BusinessConnections {
  steward: { orgId: string; name: string; slug: string | null } | null;
  listedBy: { orgId: string; name: string; slug: string | null } | null;
  /** Catalogue places that link to it (any org), with that org. */
  places: { placeId: string; orgId: string; title: string; slug: string; relation: PlaceBusinessRelation; isPrimary: boolean; isPublic: boolean }[];
  /** Published public tours whose stops are at those places. */
  tours: { orgId: string; threadId: string; title: string; slug: string }[];
}

export interface BusinessClaim {
  id: string;
  businessUserId: string;
  businessName: string;
  businessSlug: string | null;
  claimantUserId: string;
  claimantName: string | null;
  claimantEmail: string | null;
  method: BusinessClaimMethod;
  evidence: Record<string, unknown>;
  message: string | null;
  status: BusinessClaimStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
  createdAt: string;
}

export type BusinessResult<T = object> = ({ ok: true; error?: undefined } & T) | { ok: false; error: string };

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
const REMOVAL_DAYS_AFTER_CLAIM = 30;
const UUID = /^[0-9a-f-]{36}$/i;
const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));

const CATEGORY_LABELS: Record<string, string> = {
  bakery: 'Bakery & pâtisserie', butcher: 'Butcher', cheese: 'Cheese shop', wine_shop: 'Wine shop', shop: 'Shop',
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar & music', cabaret: 'Cabaret', museum: 'Museum', gallery: 'Gallery',
  church: 'Church', synagogue: 'Synagogue', theatre: 'Theatre', bookshop: 'Bookshop', market: 'Market', library: 'Library', hotel: 'Hotel',
};
export const businessCategoryLabel = (c: string | null) => (c ? CATEGORY_LABELS[c] ?? c.replace(/_/g, ' ') : null);
export const shellMarking = (stewardName: string | null) => `Unclaimed · listed by ${stewardName ?? 'the Elkdonis network'}`;

const SELECT = db`
  SELECT b.*, u.slug, u.display_name, so.name AS steward_name, lo.name AS listed_name
  FROM business_listings b
  JOIN users u ON u.id = b.user_id
  LEFT JOIN organizations so ON so.id = b.steward_org_id
  LEFT JOIN organizations lo ON lo.id = b.listed_by_org_id
`;

function mapBusiness(r: Row): BusinessListing {
  const facts = (r.facts_source ?? {}) as Record<string, FactSource>;
  const websiteStatus = (r.website_status as BusinessWebsiteStatus) ?? 'none';
  const status = r.status as BusinessStatus;
  const attributions = [...new Set(Object.values(facts).map((f) => f.attribution ?? (f.source === 'osm' ? OSM_ATTRIBUTION : null)).filter((a): a is string => !!a))];
  const steward = r.steward_org_id ? { orgId: r.steward_org_id as string, name: (r.steward_name as string) ?? (r.steward_org_id as string) } : null;
  return {
    userId: r.user_id as string,
    slug: (r.slug as string | null) ?? (r.user_id as string),
    name: r.display_name as string,
    category: (r.category as string | null) ?? null,
    categoryLabel: businessCategoryLabel((r.category as string | null) ?? null),
    streetAddress: (r.street_address as string | null) ?? null,
    postalCode: (r.postal_code as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    website: websiteStatus === 'confirmed' ? ((r.website as string | null) ?? null) : null,
    websiteStatus,
    websiteCandidate: (r.website as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    openingHours: (r.opening_hours as string | null) ?? null,
    osmRef: (r.osm_ref as string | null) ?? null,
    wikidataRef: (r.wikidata_ref as string | null) ?? null,
    factsSource: facts,
    attributions,
    photoUrl: (r.photo_url as string | null) ?? null,
    photoCredit: (r.photo_credit as string | null) ?? null,
    status,
    steward,
    listedBy: r.listed_by_org_id ? { orgId: r.listed_by_org_id as string, name: (r.listed_name as string) ?? (r.listed_by_org_id as string) } : null,
    marking: status === 'shell' ? shellMarking(steward?.name ?? ((r.listed_name as string | null) ?? null)) : null,
    claimedAt: iso(r.claimed_at),
    removalDueAt: iso(r.removal_due_at),
    removedAt: iso(r.removed_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

/** Public-safe copy: drops the pending website candidate. */
export function publicBusiness(b: BusinessListing): BusinessListing {
  return { ...b, websiteCandidate: b.websiteStatus === 'confirmed' ? b.websiteCandidate : null };
}

// ── reads ─────────────────────────────────────────────────────────────────

/** Includes removed listings (the page shows a tombstone); callers filter. */
export async function getBusinessListing(userId: string): Promise<BusinessListing | null> {
  if (!UUID.test(userId)) return null;
  const [r] = (await db`${SELECT} WHERE b.user_id = ${userId}`) as unknown as Row[];
  return r ? mapBusiness(r) : null;
}

export async function getBusinessBySlug(slug: string): Promise<BusinessListing | null> {
  const [r] = (await db`${SELECT} WHERE u.slug = ${slug} LIMIT 1`) as unknown as Row[];
  return r ? mapBusiness(r) : null;
}

/** Shells and claimed listings, not removed. Directory/console use. */
export async function listBusinesses(opts: { stewardOrgId?: string; status?: BusinessStatus; category?: string; limit?: number } = {}): Promise<BusinessListing[]> {
  const rows = (await db`
    ${SELECT}
    WHERE b.status <> 'removed'
      ${opts.stewardOrgId ? db`AND b.steward_org_id = ${opts.stewardOrgId}` : db``}
      ${opts.status ? db`AND b.status = ${opts.status}` : db``}
      ${opts.category ? db`AND b.category = ${opts.category}` : db``}
    ORDER BY u.display_name
    LIMIT ${Math.min(Math.max(opts.limit ?? 500, 1), 2000)}
  `) as unknown as Row[];
  return rows.map(mapBusiness);
}

/** Current (non-former) businesses per place, primary first. Removed listings are hidden. */
export async function listBusinessesForPlaces(placeIds: string[], opts: { includeFormer?: boolean } = {}): Promise<Map<string, PlaceBusinessLink[]>> {
  const out = new Map<string, PlaceBusinessLink[]>();
  const ids = placeIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return out;
  const rows = (await db`
    SELECT pb.place_id, pb.relation, pb.is_primary, b.*, u.slug, u.display_name, so.name AS steward_name, lo.name AS listed_name
    FROM place_businesses pb
    JOIN business_listings b ON b.user_id = pb.business_user_id
    JOIN users u ON u.id = b.user_id
    LEFT JOIN organizations so ON so.id = b.steward_org_id
    LEFT JOIN organizations lo ON lo.id = b.listed_by_org_id
    WHERE pb.place_id = ANY(${ids}::uuid[]) AND b.status <> 'removed'
      ${opts.includeFormer ? db`` : db`AND pb.relation <> 'former'`}
    ORDER BY pb.is_primary DESC, u.display_name
  `) as unknown as Row[];
  for (const r of rows) {
    const list = out.get(r.place_id as string) ?? [];
    list.push({ placeId: r.place_id as string, relation: r.relation as PlaceBusinessRelation, isPrimary: Boolean(r.is_primary), business: mapBusiness(r) });
    out.set(r.place_id as string, list);
  }
  return out;
}

/** For org cards and the business page: steward ↔ business, place ↔ business, tours visiting it. */
export async function getBusinessConnections(userId: string): Promise<BusinessConnections> {
  const empty: BusinessConnections = { steward: null, listedBy: null, places: [], tours: [] };
  if (!UUID.test(userId)) return empty;
  const [b] = (await db`
    SELECT b.steward_org_id, so.name AS steward_name, so.slug AS steward_slug, b.listed_by_org_id, lo.name AS listed_name, lo.slug AS listed_slug
    FROM business_listings b
    LEFT JOIN organizations so ON so.id = b.steward_org_id
    LEFT JOIN organizations lo ON lo.id = b.listed_by_org_id
    WHERE b.user_id = ${userId} AND b.status <> 'removed'
  `) as unknown as Row[];
  if (!b) return empty;
  const [places, tours] = await Promise.all([
    db`
      SELECT p.id, p.org_id, p.title, p.slug, p.is_public, pb.relation, pb.is_primary
      FROM place_businesses pb JOIN places p ON p.id = pb.place_id
      WHERE pb.business_user_id = ${userId} AND p.archived_at IS NULL
      ORDER BY pb.is_primary DESC, p.title
    ` as unknown as Promise<Row[]>,
    db`
      SELECT DISTINCT t.org_id, t.id, t.title, t.slug
      FROM place_businesses pb
      JOIN tour_stops s ON s.place_id = pb.place_id
      JOIN threads t ON t.id = s.thread_id
      WHERE pb.business_user_id = ${userId} AND pb.relation <> 'former'
        AND t.status = 'published' AND t.visibility = 'PUBLIC'
      ORDER BY t.title
    ` as unknown as Promise<Row[]>,
  ]);
  return {
    steward: b.steward_org_id ? { orgId: b.steward_org_id as string, name: b.steward_name as string, slug: (b.steward_slug as string | null) ?? null } : null,
    listedBy: b.listed_by_org_id ? { orgId: b.listed_by_org_id as string, name: b.listed_name as string, slug: (b.listed_slug as string | null) ?? null } : null,
    places: places.map((p) => ({
      placeId: p.id as string,
      orgId: p.org_id as string,
      title: p.title as string,
      slug: p.slug as string,
      relation: p.relation as PlaceBusinessRelation,
      isPrimary: Boolean(p.is_primary),
      isPublic: p.is_public == null ? true : Boolean(p.is_public),
    })),
    tours: tours.map((t) => ({ orgId: t.org_id as string, threadId: t.id as string, title: t.title as string, slug: t.slug as string })),
  };
}

// ── access ────────────────────────────────────────────────────────────────

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [r] = (await db`SELECT is_admin FROM users WHERE id = ${userId}`) as unknown as Row[];
  return Boolean(r?.is_admin);
}
async function isOrgOwner(userId: string, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  const [r] = (await db`SELECT 1 FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId} AND role = 'owner'`) as unknown as Row[];
  return !!r;
}

/** Owners of the steward org, or platform admins. */
export async function canStewardBusiness(userId: string, business: Pick<BusinessListing, 'steward'>): Promise<boolean> {
  return (await isPlatformAdmin(userId)) || (await isOrgOwner(userId, business.steward?.orgId ?? null));
}

/** The steward, or the person who claimed it (light owned listing), or a platform admin. */
export async function canEditBusiness(userId: string, businessUserId: string): Promise<boolean> {
  const b = await getBusinessListing(businessUserId);
  if (!b || b.status === 'removed') return isPlatformAdmin(userId);
  if (b.status === 'claimed') {
    const [r] = (await db`SELECT claimed_by_user FROM business_listings WHERE user_id = ${businessUserId}`) as unknown as Row[];
    return r?.claimed_by_user === userId || (await isPlatformAdmin(userId));
  }
  return canStewardBusiness(userId, b);
}

// ── writes ────────────────────────────────────────────────────────────────

/** ASCII base for a business slug: "Café de Flore" -> "Cafe de Flore", "Sacré-Cœur" -> "Sacre-Coeur". */
export function businessSlugBase(name: string): string {
  return name
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ');
}

function cleanUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const s = u.trim().replace(/^http:\/\//i, 'https://');
  return /^https:\/\/[^\s]+$/i.test(s) ? s : null;
}

/** Is a ref (or name near a point) tombstoned? Imports skip those. */
async function findExisting(input: BusinessShellInput): Promise<Row | null> {
  if (input.osmRef) {
    const [r] = (await db`SELECT user_id, status FROM business_listings WHERE osm_ref = ${input.osmRef}`) as unknown as Row[];
    if (r) return r;
  }
  if (input.wikidataRef) {
    const [r] = (await db`SELECT user_id, status FROM business_listings WHERE wikidata_ref = ${input.wikidataRef}`) as unknown as Row[];
    if (r) return r;
  }
  if (input.lat != null && input.lng != null) {
    const d = 150 / 111_320;
    const [r] = (await db`
      SELECT b.user_id, b.status FROM business_listings b JOIN users u ON u.id = b.user_id
      WHERE lower(u.display_name) = lower(${input.name.trim()})
        AND b.lat BETWEEN ${input.lat - d} AND ${input.lat + d} AND b.lng BETWEEN ${input.lng - d * 1.5} AND ${input.lng + d * 1.5}
      LIMIT 1
    `) as unknown as Row[];
    if (r) return r;
  }
  if (input.postalCode) {
    const [r] = (await db`
      SELECT b.user_id, b.status FROM business_listings b JOIN users u ON u.id = b.user_id
      WHERE lower(u.display_name) = lower(${input.name.trim()}) AND b.postal_code = ${input.postalCode} LIMIT 1
    `) as unknown as Row[];
    if (r) return r;
  }
  return null;
}

/**
 * Create a stewarded shell (or return the existing listing for the same refs / name+place).
 * Refuses tombstoned (removed) matches. The caller has checked the actor may steward for
 * `stewardOrgId` (an owner of that org, or a platform admin); `actorUserId` may be null for
 * scripts.
 */
export async function createBusinessShell(
  input: BusinessShellInput,
  ctx: { stewardOrgId: string | null; actorUserId: string | null }
): Promise<BusinessResult<{ business: BusinessListing; created: boolean }>> {
  const name = input.name?.trim();
  if (!name || name.length < 2) return { ok: false, error: 'A business needs a name.' };
  const existing = await findExisting(input);
  if (existing) {
    if (existing.status === 'removed') return { ok: false, error: 'This business asked to be removed; it is not re-listed.' };
    return { ok: true, business: (await getBusinessListing(existing.user_id as string))!, created: false };
  }
  let stewardName: string | null = null;
  if (ctx.stewardOrgId) {
    const [o] = (await db`SELECT name FROM organizations WHERE id = ${ctx.stewardOrgId}`) as unknown as Row[];
    if (!o) return { ok: false, error: 'Unknown steward org.' };
    stewardName = o.name as string;
  }
  const category = input.category?.trim() || null;
  const made = await createUnclaimedProfile({
    displayName: name,
    // slugify drops accented letters ("Café" -> "caf"); transliterate first.
    slug: businessSlugBase(name),
    entityType: 'organization',
    headline: [businessCategoryLabel(category), shellMarking(stewardName)].filter(Boolean).join(' · '),
    city: input.city ?? null,
    country: input.country ?? null,
    postalCode: input.postalCode ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    socialLinks: [],
    createdBy: ctx.actorUserId ?? undefined,
    sourceNote: `business:${ctx.stewardOrgId ?? 'platform'}`,
  } as Parameters<typeof createUnclaimedProfile>[0]);
  if (!("userId" in made)) return { ok: false, error: (made as { error: string }).error };
  const website = cleanUrl(input.website);
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO business_listings (
        user_id, category, street_address, postal_code, city, country, lat, lng, website, website_status, phone, opening_hours,
        osm_ref, wikidata_ref, facts_source, photo_url, photo_credit, status, steward_org_id, listed_by_org_id, listed_by_user
      ) VALUES (
        ${made.userId}, ${category}, ${input.streetAddress ?? null}, ${input.postalCode ?? null}, ${input.city ?? null}, ${input.country ?? null},
        ${input.lat ?? null}, ${input.lng ?? null}, ${website}, ${website ? (input.websiteStatus ?? 'confirmed') : 'none'},
        ${input.phone ?? null}, ${input.openingHours ?? null}, ${input.osmRef ?? null}, ${input.wikidataRef ?? null},
        ${tx.json((input.factsSource ?? {}) as never)}, ${input.photoUrl ?? null}, ${input.photoCredit ?? null}, 'shell',
        ${ctx.stewardOrgId}, ${ctx.stewardOrgId}, ${ctx.actorUserId}
      )
    `;
    // Listed in the directory (Justin, 2026-11-04), and published on the steward org's page like its other profiles.
    await tx`UPDATE users SET directory_listed = true WHERE id = ${made.userId}`;
    if (ctx.stewardOrgId) {
      await tx`
        INSERT INTO org_profiles (org_id, user_id, role_title, is_public, tags)
        VALUES (${ctx.stewardOrgId}, ${made.userId}, ${businessCategoryLabel(category)}, true, ${tx.array(['business', 'unclaimed'])})
        ON CONFLICT (org_id, user_id) DO NOTHING
      `;
    }
  });
  return { ok: true, business: (await getBusinessListing(made.userId))!, created: true };
}

/** Update facts. Caller checked canEditBusiness. Keeps the users row's public fields in step. */
export async function updateBusinessFacts(userId: string, patch: BusinessFactsPatch): Promise<BusinessResult<{ business: BusinessListing }>> {
  const b = await getBusinessListing(userId);
  if (!b || b.status === 'removed') return { ok: false, error: 'Business not found.' };
  const has = (k: keyof BusinessFactsPatch) => Object.prototype.hasOwnProperty.call(patch, k);
  const website = has('website') ? cleanUrl(patch.website) : b.websiteCandidate;
  const websiteStatus: BusinessWebsiteStatus = !website ? 'none' : has('websiteStatus') ? (patch.websiteStatus ?? 'confirmed') : has('website') ? 'confirmed' : b.websiteStatus;
  const facts = has('factsSource') ? { ...b.factsSource, ...(patch.factsSource ?? {}) } : b.factsSource;
  await db.begin(async (tx) => {
    await tx`
      UPDATE business_listings SET
        category = ${has('category') ? patch.category ?? null : b.category},
        street_address = ${has('streetAddress') ? patch.streetAddress ?? null : b.streetAddress},
        postal_code = ${has('postalCode') ? patch.postalCode ?? null : b.postalCode},
        city = ${has('city') ? patch.city ?? null : b.city},
        country = ${has('country') ? patch.country ?? null : b.country},
        lat = ${has('lat') ? patch.lat ?? null : b.lat}, lng = ${has('lng') ? patch.lng ?? null : b.lng},
        website = ${website}, website_status = ${websiteStatus},
        phone = ${has('phone') ? patch.phone ?? null : b.phone},
        opening_hours = ${has('openingHours') ? patch.openingHours ?? null : b.openingHours},
        osm_ref = ${has('osmRef') ? patch.osmRef ?? null : b.osmRef},
        wikidata_ref = ${has('wikidataRef') ? patch.wikidataRef ?? null : b.wikidataRef},
        facts_source = ${tx.json(facts as never)},
        photo_url = ${has('photoUrl') ? patch.photoUrl ?? null : b.photoUrl},
        photo_credit = ${has('photoCredit') ? patch.photoCredit ?? null : b.photoCredit},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    if (has('name') && patch.name?.trim()) await tx`UPDATE users SET display_name = ${patch.name.trim()} WHERE id = ${userId}`;
    await tx`
      UPDATE users SET city = ${has('city') ? patch.city ?? null : b.city}, postal_code = ${has('postalCode') ? patch.postalCode ?? null : b.postalCode},
        lat = ${has('lat') ? patch.lat ?? null : b.lat}, lng = ${has('lng') ? patch.lng ?? null : b.lng}
      WHERE id = ${userId}
    `;
  });
  return { ok: true, business: (await getBusinessListing(userId))! };
}

/** Link a business to a place (org-owned). Making it primary demotes the current primary. */
export async function linkPlaceBusiness(input: {
  placeId: string;
  businessUserId: string;
  orgId: string;
  relation?: PlaceBusinessRelation;
  isPrimary?: boolean;
  actorUserId: string | null;
}): Promise<BusinessResult> {
  const [p] = (await db`SELECT id FROM places WHERE id = ${input.placeId} AND org_id = ${input.orgId}`) as unknown as Row[];
  if (!p) return { ok: false, error: 'That place is not in this catalogue.' };
  const b = await getBusinessListing(input.businessUserId);
  if (!b || b.status === 'removed') return { ok: false, error: 'Business not found.' };
  const relation = input.relation ?? 'operates';
  const primary = relation !== 'former' && (input.isPrimary ?? true);
  await db.begin(async (tx) => {
    if (primary) await tx`UPDATE place_businesses SET is_primary = false WHERE place_id = ${input.placeId} AND is_primary AND business_user_id <> ${input.businessUserId}`;
    await tx`
      INSERT INTO place_businesses (place_id, business_user_id, org_id, relation, is_primary, created_by)
      VALUES (${input.placeId}, ${input.businessUserId}, ${input.orgId}, ${relation}, ${primary}, ${input.actorUserId})
      ON CONFLICT (place_id, business_user_id) DO UPDATE SET relation = EXCLUDED.relation, is_primary = EXCLUDED.is_primary
    `;
  });
  return { ok: true };
}

/** Unlink, or keep as history with relation 'former' (default). */
export async function unlinkPlaceBusiness(input: { placeId: string; businessUserId: string; orgId: string; keepAsFormer?: boolean }): Promise<BusinessResult> {
  if (input.keepAsFormer !== false) {
    await db`
      UPDATE place_businesses SET relation = 'former', is_primary = false
      WHERE place_id = ${input.placeId} AND business_user_id = ${input.businessUserId} AND org_id = ${input.orgId}
    `;
  } else {
    await db`DELETE FROM place_businesses WHERE place_id = ${input.placeId} AND business_user_id = ${input.businessUserId} AND org_id = ${input.orgId}`;
  }
  return { ok: true };
}

/** Hand a shell to another org (or the platform with null). Caller checked canStewardBusiness. */
export async function transferStewardship(businessUserId: string, toOrgId: string | null): Promise<BusinessResult> {
  if (toOrgId) {
    const [o] = (await db`SELECT id FROM organizations WHERE id = ${toOrgId}`) as unknown as Row[];
    if (!o) return { ok: false, error: 'Unknown org.' };
  }
  const rows = (await db`
    UPDATE business_listings SET steward_org_id = ${toOrgId}, updated_at = NOW()
    WHERE user_id = ${businessUserId} AND status = 'shell' RETURNING user_id
  `) as unknown as Row[];
  return rows[0] ? { ok: true } : { ok: false, error: 'Only an unclaimed listing has a steward.' };
}

// ── claims (stub submission; approval keeps the listing light) ────────────

export async function requestBusinessClaim(input: {
  businessUserId: string;
  claimantUserId: string;
  method: BusinessClaimMethod;
  evidence?: Record<string, unknown>;
  message?: string | null;
}): Promise<BusinessResult<{ claimId: string }>> {
  const b = await getBusinessListing(input.businessUserId);
  if (!b || b.status !== 'shell') return { ok: false, error: 'This listing cannot be claimed.' };
  if (!['domain_email', 'phone', 'document', 'in_person', 'steward_vouch'].includes(input.method)) return { ok: false, error: 'Choose how we can verify you.' };
  try {
    const [r] = (await db`
      INSERT INTO business_claims (business_user_id, claimant_user_id, method, evidence, message)
      VALUES (${input.businessUserId}, ${input.claimantUserId}, ${input.method}, ${db.json((input.evidence ?? {}) as never)},
              ${input.message?.trim().slice(0, 4000) || null})
      RETURNING id
    `) as unknown as Row[];
    return { ok: true, claimId: r!.id as string };
  } catch (err) {
    if (String((err as { code?: string }).code) === '23505') return { ok: false, error: 'You already have a claim waiting on this listing.' };
    throw err;
  }
}

export async function listBusinessClaims(opts: { status?: BusinessClaimStatus; stewardOrgId?: string; businessUserId?: string } = {}): Promise<BusinessClaim[]> {
  const rows = (await db`
    SELECT c.*, bu.display_name AS business_name, bu.slug AS business_slug, cu.display_name AS claimant_name, cu.email AS claimant_email
    FROM business_claims c
    JOIN users bu ON bu.id = c.business_user_id
    JOIN users cu ON cu.id = c.claimant_user_id
    LEFT JOIN business_listings b ON b.user_id = c.business_user_id
    WHERE TRUE
      ${opts.status ? db`AND c.status = ${opts.status}` : db``}
      ${opts.stewardOrgId ? db`AND b.steward_org_id = ${opts.stewardOrgId}` : db``}
      ${opts.businessUserId ? db`AND c.business_user_id = ${opts.businessUserId}` : db``}
    ORDER BY (c.status = 'pending') DESC, c.created_at DESC
    LIMIT 300
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    businessUserId: r.business_user_id as string,
    businessName: r.business_name as string,
    businessSlug: (r.business_slug as string | null) ?? null,
    claimantUserId: r.claimant_user_id as string,
    claimantName: (r.claimant_name as string | null) ?? null,
    claimantEmail: (r.claimant_email as string | null) ?? null,
    method: r.method as BusinessClaimMethod,
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    message: (r.message as string | null) ?? null,
    status: r.status as BusinessClaimStatus,
    decidedBy: (r.decided_by as string | null) ?? null,
    decidedAt: iso(r.decided_at),
    reason: (r.reason as string | null) ?? null,
    createdAt: iso(r.created_at)!,
  }));
}

/** Who may decide: platform admins; the steward org's owners too when the method is in_person. */
export async function canDecideBusinessClaim(userId: string, claimId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) return true;
  const [c] = (await db`
    SELECT c.method, b.steward_org_id FROM business_claims c JOIN business_listings b ON b.user_id = c.business_user_id WHERE c.id = ${claimId}
  `) as unknown as Row[];
  return !!c && c.method === 'in_person' && (await isOrgOwner(userId, (c.steward_org_id as string | null) ?? null));
}

/**
 * Approve or reject. Approval: the listing becomes a light owned listing (status
 * 'claimed', claimed_by_user, users.claim_status/claimed_by/verified), the steward link is
 * kept as listed_by, and other pending claims are rejected with a reason. The sentinel is
 * NOT merged into the claimant. Caller checked canDecideBusinessClaim.
 */
export async function decideBusinessClaim(claimId: string, deciderUserId: string, decision: 'approved' | 'rejected', reason?: string): Promise<BusinessResult> {
  const [c] = (await db`SELECT * FROM business_claims WHERE id = ${claimId}`) as unknown as Row[];
  if (!c || c.status !== 'pending') return { ok: false, error: 'This claim is not waiting for a decision.' };
  await db.begin(async (tx) => {
    await tx`
      UPDATE business_claims SET status = ${decision}, decided_by = ${deciderUserId}, decided_at = NOW(),
        reason = ${reason?.trim().slice(0, 1000) || null}, updated_at = NOW()
      WHERE id = ${claimId}
    `;
    if (decision === 'approved') {
      await tx`
        UPDATE business_listings SET status = 'claimed', claimed_by_user = ${c.claimant_user_id as string}, claimed_at = NOW(),
          steward_org_id = NULL, updated_at = NOW()
        WHERE user_id = ${c.business_user_id as string}
      `;
      await tx`
        UPDATE users SET claim_status = 'claimed', claimed_by = ${c.claimant_user_id as string}, verified = true, verified_at = NOW()
        WHERE id = ${c.business_user_id as string}
      `;
      await tx`
        UPDATE business_claims SET status = 'rejected', decided_by = ${deciderUserId}, decided_at = NOW(),
          reason = 'Another claim on this business was approved.', updated_at = NOW()
        WHERE business_user_id = ${c.business_user_id as string} AND status = 'pending' AND id <> ${claimId}
      `;
    }
  });
  return { ok: true };
}

// ── removal ───────────────────────────────────────────────────────────────

/**
 * Anyone may ask. A shell is removed at once (tombstone). A claimed listing gets a
 * 30-day deadline (removal_due_at) for the steward/admin to act; the owner can also remove
 * their own listing at once through removeBusiness.
 */
export async function requestBusinessRemoval(input: { businessUserId: string; requesterUserId: string | null; reason?: string | null; contact?: string | null }): Promise<BusinessResult<{ removed: boolean; dueAt: string | null }>> {
  const b = await getBusinessListing(input.businessUserId);
  if (!b || b.status === 'removed') return { ok: false, error: 'Business not found.' };
  const reason = [input.reason?.trim(), input.contact?.trim() ? `contact: ${input.contact.trim()}` : null].filter(Boolean).join(' — ').slice(0, 1000) || null;
  if (b.status === 'shell') {
    await removeBusiness(input.businessUserId, reason ?? 'Removal requested before claim');
    await db`UPDATE business_listings SET removal_requested_at = NOW(), removal_requested_by = ${input.requesterUserId} WHERE user_id = ${input.businessUserId}`;
    return { ok: true, removed: true, dueAt: null };
  }
  const [r] = (await db`
    UPDATE business_listings SET removal_requested_at = NOW(), removal_requested_by = ${input.requesterUserId},
      removal_due_at = NOW() + (${REMOVAL_DAYS_AFTER_CLAIM} || ' days')::interval, removed_reason = ${reason}, updated_at = NOW()
    WHERE user_id = ${input.businessUserId}
    RETURNING removal_due_at
  `) as unknown as Row[];
  return { ok: true, removed: false, dueAt: iso(r?.removal_due_at) };
}

/** Tombstone: hidden everywhere (directory, org pages, place links); refs kept so imports skip it. */
export async function removeBusiness(businessUserId: string, reason: string): Promise<BusinessResult> {
  await db.begin(async (tx) => {
    await tx`
      UPDATE business_listings SET status = 'removed', removed_at = NOW(), removed_reason = COALESCE(${reason}, removed_reason), updated_at = NOW()
      WHERE user_id = ${businessUserId}
    `;
    await tx`UPDATE users SET directory_listed = false WHERE id = ${businessUserId}`;
    await tx`UPDATE org_profiles SET is_public = false WHERE user_id = ${businessUserId}`;
    await tx`UPDATE place_businesses SET relation = 'former', is_primary = false WHERE business_user_id = ${businessUserId}`;
  });
  return { ok: true };
}

/** Steward/admin undo of a mistaken removal (only while unclaimed). */
export async function restoreBusiness(businessUserId: string): Promise<BusinessResult> {
  const rows = (await db`
    UPDATE business_listings SET status = CASE WHEN claimed_by_user IS NULL THEN 'shell' ELSE 'claimed' END,
      removed_at = NULL, removal_due_at = NULL, updated_at = NOW()
    WHERE user_id = ${businessUserId} AND status = 'removed' RETURNING user_id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: 'Not removed.' };
  await db`UPDATE users SET directory_listed = true WHERE id = ${businessUserId}`;
  await db`UPDATE org_profiles SET is_public = true WHERE user_id = ${businessUserId} AND 'business' = ANY(tags)`;
  return { ok: true };
}
