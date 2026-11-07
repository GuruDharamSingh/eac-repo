"use server";
// CONTRACT: elktours steward actions for network business listings (shells) at catalogue places. Types: @elkdonis/services/businesses + lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  canDecideBusinessClaim,
  canStewardBusiness,
  createBusinessShell,
  decideBusinessClaim,
  getBusinessConnections,
  getBusinessListing,
  linkPlaceBusiness,
  listBusinessClaims,
  listBusinesses,
  removeBusiness,
  restoreBusiness,
  unlinkPlaceBusiness,
  updateBusinessFacts,
  type BusinessClaim,
  type BusinessConnections,
  type BusinessFactsPatch,
  type BusinessListing,
  type PlaceBusinessRelation,
} from "@elkdonis/services/businesses";
import { requireOrgEditor } from "@/lib/auth";
import { getPlace } from "@/lib/places";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

/**
 * Steward = this org (elktours). Per Justin (2026-11-04) any org's OWNERS may steward
 * shells: writes require an elktours owner (or a platform admin); guides can read.
 * Claims: platform admins decide; elktours owners may decide in_person claims.
 */
const ORG = siteConfig.orgId;

async function requireOwner() {
  const viewer = await requireOrgEditor();
  return viewer;
}
const fail = (err: unknown, fallback: string): { ok: false; error: string } => {
  console.error("[elktours] business action:", err);
  return { ok: false, error: err instanceof Error ? err.message : fallback };
};
function revalidatePlace(placeId?: string) {
  revalidatePath("/manage/places");
  if (placeId) revalidatePath(`/manage/places/${placeId}`);
  revalidatePath("/tours");
}

/** This org's stewarded listings (and claimed ones it first listed). */
export async function listStewardBusinessesAction(): Promise<BusinessListing[]> {
  await requireOrgEditor();
  return listBusinesses({ stewardOrgId: ORG });
}

export async function getBusinessAction(userId: string): Promise<{ business: BusinessListing; connections: BusinessConnections; canSteward: boolean } | null> {
  const viewer = await requireOrgEditor();
  const business = await getBusinessListing(userId);
  if (!business) return null;
  return { business, connections: await getBusinessConnections(userId), canSteward: await canStewardBusiness(viewer.userId, business) };
}

/**
 * "Create a business listing from this place": a shell prefilled from the place (title,
 * kind, position, address, confirmed website), linked as the place's primary business.
 * Returns the existing listing when the refs/name already match one.
 */
export async function createBusinessFromPlaceAction(placeId: string, overrides: { name?: string; category?: string | null } = {}): Promise<Result<{ business: BusinessListing; created: boolean }>> {
  const viewer = await requireOwner();
  if (viewer.role !== "owner") return { ok: false, error: "Only the company owners can list a business." };
  const place = await getPlace(placeId);
  if (!place) return { ok: false, error: "Place not found." };
  const site = (place.links ?? []).find((l) => l.kind === "website");
  const wd = (place.links ?? []).find((l) => l.kind === "wikidata");
  try {
    const res = await createBusinessShell(
      {
        name: overrides.name?.trim() || place.title.replace(/,\s*No\.\s*\d+\s*$/i, ""),
        category: overrides.category ?? place.operatingKind ?? null,
        streetAddress: place.address,
        city: "Paris",
        country: "FR",
        lat: place.lat,
        lng: place.lng,
        website: site?.url ?? null,
        websiteStatus: site ? "confirmed" : "none",
        wikidataRef: wd?.sourceRef?.startsWith("wikidata:") ? wd.sourceRef.slice(9) : null,
        factsSource: {
          name: { source: "steward", note: `from the ${siteConfig.orgName} catalogue` },
          ...(site ? { website: { source: site.source === "osm" ? "osm" : site.source === "wikidata" ? "wikidata" : "web", ref: site.sourceRef } } : {}),
        },
      },
      { stewardOrgId: ORG, actorUserId: viewer.userId }
    );
    if (!res.ok) return { ok: false, error: (res as { error: string }).error };
    const linked = await linkPlaceBusiness({ placeId, businessUserId: res.business.userId, orgId: ORG, relation: "operates", isPrimary: true, actorUserId: viewer.userId });
    if (!linked.ok) return { ok: false, error: (linked as { error: string }).error };
    revalidatePlace(placeId);
    return { ok: true, business: res.business, created: res.created };
  } catch (err) {
    return fail(err, "Could not create the listing.");
  }
}

export async function linkPlaceBusinessAction(placeId: string, businessUserId: string, opts: { relation?: PlaceBusinessRelation; isPrimary?: boolean } = {}): Promise<Result> {
  const viewer = await requireOrgEditor();
  try {
    const r = await linkPlaceBusiness({ placeId, businessUserId, orgId: ORG, relation: opts.relation, isPrimary: opts.isPrimary, actorUserId: viewer.userId });
    if (r.ok) revalidatePlace(placeId);
    return r;
  } catch (err) {
    return fail(err, "Could not link the business.");
  }
}

/** Default keeps the link as history ('former'). */
export async function unlinkPlaceBusinessAction(placeId: string, businessUserId: string, keepAsFormer = true): Promise<Result> {
  await requireOrgEditor();
  const r = await unlinkPlaceBusiness({ placeId, businessUserId, orgId: ORG, keepAsFormer });
  revalidatePlace(placeId);
  return r;
}

export async function updateBusinessFactsAction(userId: string, patch: BusinessFactsPatch): Promise<Result<{ business: BusinessListing }>> {
  const viewer = await requireOrgEditor();
  const b = await getBusinessListing(userId);
  if (!b || !(await canStewardBusiness(viewer.userId, b))) return { ok: false, error: "Only the steward org's owners can edit this listing." };
  try {
    const r = await updateBusinessFacts(userId, { ...patch, factsSource: { ...(patch.factsSource ?? {}) } });
    revalidatePlace();
    return r;
  } catch (err) {
    return fail(err, "Could not save the listing.");
  }
}

/** Removal by the steward (immediate tombstone). */
export async function removeBusinessAction(userId: string, reason: string): Promise<Result> {
  const viewer = await requireOrgEditor();
  const b = await getBusinessListing(userId);
  if (!b || !(await canStewardBusiness(viewer.userId, b))) return { ok: false, error: "Only the steward org's owners can remove this listing." };
  const r = await removeBusiness(userId, reason?.trim() || "Removed by the steward");
  revalidatePlace();
  return r;
}

export async function restoreBusinessAction(userId: string): Promise<Result> {
  const viewer = await requireOrgEditor();
  const b = await getBusinessListing(userId);
  if (!b || !(await canStewardBusiness(viewer.userId, { steward: b.steward ?? b.listedBy }))) return { ok: false, error: "Only the steward org's owners can restore this listing." };
  const r = await restoreBusiness(userId);
  revalidatePlace();
  return r;
}

/** Claims on this org's stewarded listings, for the steward queue. */
export async function listBusinessClaimsAction(status?: BusinessClaim["status"]): Promise<(BusinessClaim & { canDecide: boolean })[]> {
  const viewer = await requireOrgEditor();
  const claims = await listBusinessClaims({ stewardOrgId: ORG, status });
  return Promise.all(claims.map(async (c) => ({ ...c, canDecide: c.status === "pending" && (await canDecideBusinessClaim(viewer.userId, c.id)) })));
}

/** Owners decide in_person claims on their shells; anything else needs a platform admin. */
export async function decideBusinessClaimAction(claimId: string, decision: "approved" | "rejected", reason?: string): Promise<Result> {
  const viewer = await requireOrgEditor();
  if (!(await canDecideBusinessClaim(viewer.userId, claimId))) return { ok: false, error: "A platform admin decides this claim (owners decide in-person claims only)." };
  const r = await decideBusinessClaim(claimId, viewer.userId, decision, reason);
  revalidatePlace();
  return r;
}

/** Count helper for the manage nav badge. */
export async function pendingBusinessClaimsCountAction(): Promise<number> {
  await requireOrgEditor();
  const [r] = (await db`
    SELECT COUNT(*)::int AS n FROM business_claims c JOIN business_listings b ON b.user_id = c.business_user_id
    WHERE c.status = 'pending' AND b.steward_org_id = ${ORG}
  `) as unknown as { n: number }[];
  return Number(r?.n ?? 0);
}
