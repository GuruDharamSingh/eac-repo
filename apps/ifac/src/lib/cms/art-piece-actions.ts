"use server";

import { revalidatePath } from "next/cache";
import { createArtwork } from "@elkdonis/commerce/server";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import type { ArtworkKind } from "@elkdonis/commerce/types";
import { getHubViewer } from "@/lib/hub-auth";

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
// A piece is created as a DRAFT. Publishing work for sale involves a price, a
// store and an agreement about the cut; none of that should happen because
// someone filled in a form on a hub tile.
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
}

export type ArtPieceResult =
  | { ok: true; id: string; slug: string }
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
}> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, reason: "signed-out" };
  const store = await getStoreForUser(viewer.userId).catch(() => null);
  if (!store) return { ok: false, reason: "no-store" };
  if (store.status !== "active") return { ok: false, reason: "store-pending" };
  return { ok: true };
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

  try {
    const { id, slug } = await createArtwork({
      artistUserId: viewer.userId,
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
      // be catalogued before it is priced, and the draft status means nothing
      // is on sale either way.
      priceMinor: Math.max(0, Math.round((num(input.price) ?? 0) * 100)),
      // "hero", not "primary" — the role vocabulary is hero | detail | scale |
      // wall | video, and the first hero becomes the artwork's primary_image_id.
      images: [{ url: input.imageUrl.trim(), role: "hero", alt: title }],
    });

    revalidatePath("/hub");
    return { ok: true, id, slug };
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
