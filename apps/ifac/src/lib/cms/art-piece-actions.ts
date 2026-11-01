"use server";

import { revalidatePath } from "next/cache";
import { createArtwork, publishArtwork } from "@elkdonis/commerce/server";
import { getStoreForUser, getStoreForOrg } from "@elkdonis/commerce/queries";
import { canActForStore } from "@elkdonis/commerce/server";
import { MARKETPLACE_ORG } from "./marketplace";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { ArtworkKind } from "@elkdonis/commerce/types";
import { getHubViewer } from "@/lib/hub-auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// Listing a piece of work, from the hub.
//
// Writes to `artwork` through `createArtwork` — the commerce package's own
// path, which resolves the store, derives a unique slug, writes the default
// variant and the media rows in ONE transaction. IFAC does not get its own
// artwork table or its own INSERT: art-auction is the store reference for the
// network, and a second write path is how two representations of the same
// object start to drift.
//
// A piece is published as soon as it is saved (decided 2026-09-24): it goes
// live on art-auction and the member is sent to its page there. Only members
// with an active store reach the form, so the store and its cut are already
// agreed. A blank price publishes as "price on request".
// ============================================================================

export interface ArtPieceInput {
  title: string;
  /** The image is the point of this form — a piece with no picture is a note. */
  imageUrl: string;
  descriptionHtml?: string;
  medium?: string;
  yearCreated?: string;
  heightCm?: string;
  widthCm?: string;
  depthCm?: string;
  kind?: ArtworkKind;
  /** Major units as typed — "1200.50". Converted here. */
  price?: string;
  certificateOfAuthenticity?: boolean;
  provenanceNotes?: string;
  /** List in IFAC's store instead of the member's own (migration 209). */
  listAsOrg?: boolean;
}

export type ArtPieceResult =
  | { ok: true; id: string; slug: string; url: string }
  | { ok: false; error: string };

function num(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whether this member can list anything at all.
 *
 * `createArtwork` throws "You do not have a store here yet." from inside a
 * transaction, which is the right guard and the wrong first experience. The
 * surface asks this before drawing the form, so someone without a store is
 * told what to do rather than made to fill in eight fields and then refused.
 */
export async function canListArtPieceAction(): Promise<{
  ok: boolean;
  reason?: "signed-out" | "no-store" | "store-pending";
  /** Set when the viewer may also list in IFAC's own store. */
  orgStoreName?: string | null;
}> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, reason: "signed-out" };
  const [store, orgStore] = await Promise.all([
    getStoreForUser(viewer.userId).catch(() => null),
    getStoreForOrg(siteConfig.orgId, MARKETPLACE_ORG).catch(() => null),
  ]);
  const canListForOrg =
    orgStore?.status === "active" && (await canActForStore(viewer.userId, orgStore.id));
  const orgStoreName = canListForOrg ? siteConfig.orgName : null;
  if (!store) {
    // No personal store, but a seat on IFAC's: the form opens for the org.
    return canListForOrg ? { ok: true, orgStoreName } : { ok: false, reason: "no-store" };
  }
  if (store.status !== "active") {
    return canListForOrg ? { ok: true, orgStoreName } : { ok: false, reason: "store-pending" };
  }
  return { ok: true, orgStoreName };
}

export async function createArtPieceAction(
  input: ArtPieceInput
): Promise<ArtPieceResult> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };

  const title = (input.title ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give the piece a title" };
  if (!input.imageUrl?.trim()) {
    return { ok: false, error: "A piece needs an image" };
  }

  // Which store: the member's own, or IFAC's when asked and permitted. The
  // commerce layer checks the actor against the store either way.
  let storeRef: { storeId?: string; artistUserId?: string | null };
  if (input.listAsOrg) {
    const orgStore = await getStoreForOrg(siteConfig.orgId, MARKETPLACE_ORG).catch(() => null);
    if (!orgStore || !(await canActForStore(viewer.userId, orgStore.id))) {
      return { ok: false, error: "You are not on IFAC's store team." };
    }
    storeRef = { storeId: orgStore.id, artistUserId: null };
  } else {
    storeRef = { artistUserId: viewer.userId };
  }

  try {
    const { id, slug } = await createArtwork({
      ...storeRef,
      actorUserId: viewer.userId,
      title,
      descriptionHtml: input.descriptionHtml?.trim() || null,
      kind: input.kind ?? "original",
      medium: input.medium?.trim() || null,
      yearCreated: num(input.yearCreated),
      heightCm: num(input.heightCm),
      widthCm: num(input.widthCm),
      depthCm: num(input.depthCm),
      certificateOfAuthenticity: Boolean(input.certificateOfAuthenticity),
      provenanceNotes: input.provenanceNotes?.trim() || null,
      // Minor units. A blank price is zero rather than an error — a piece can
      // be catalogued before it is priced; published at zero it shows as
      // "price on request" and cannot be added to a cart.
      priceMinor: Math.max(0, Math.round((num(input.price) ?? 0) * 100)),
      // "hero", not "primary" — the role vocabulary is hero | detail | scale |
      // wall | video, and the first hero becomes the artwork's primary_image_id.
      images: [{ url: input.imageUrl.trim(), role: "hero", alt: title }],
    });

    await publishArtwork(id, viewer.userId);

    revalidatePath("/hub");
    const url = marketplaceLinks(siteConfig.marketplaceUrl, { from: "ifac", handoff: true }).artwork(id);
    return { ok: true, id, slug, url };
  } catch (error) {
    console.error("[ifac] createArtPieceAction:", error);
    // `requireActiveStore` throws prose meant to be read — pass it through
    // rather than replacing it with something vaguer.
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      error: message.includes("store") ? message : "Could not save that piece",
    };
  }
}
