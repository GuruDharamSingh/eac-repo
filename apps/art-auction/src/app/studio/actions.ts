"use server";

import { revalidatePath } from "next/cache";
import {
  applyAsArtist,
  updateArtistProfile,
  createArtwork,
  updateArtwork,
  setArtworkMedia,
  publishArtwork,
  archiveArtwork,
} from "@elkdonis/commerce/server";
import type { ArtworkMediaInput, Currency } from "@elkdonis/commerce/types";
import { getCurrentUserId, requireApprovedArtist } from "@/lib/marketplace-auth";

export type ArtistLinkInput = { label: string; url: string };

export type ApplyArtistInput = {
  displayName: string;
  headline?: string;
  city?: string;
  photoUrl?: string;
  bioHtml?: string;
  payoutEmail: string;
  defaultCurrency?: Currency;
  links?: ArtistLinkInput[];
};

export async function applyArtistAction(
  input: ApplyArtistInput
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  if (!input.displayName?.trim())
    return { ok: false, error: "A display name is required." };
  if (!input.payoutEmail?.trim())
    return { ok: false, error: "A payout email is required." };

  try {
    await applyAsArtist({
      userId,
      displayName: input.displayName.trim(),
      headline: input.headline?.trim() || null,
      city: input.city?.trim() || null,
      photoUrl: input.photoUrl?.trim() || null,
      bioHtml: input.bioHtml ?? null,
      payoutEmail: input.payoutEmail.trim(),
      defaultCurrency: input.defaultCurrency,
      links: input.links,
    });
    revalidatePath("/studio");
    revalidatePath("/studio/apply");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateProfileAction(
  input: ApplyArtistInput
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireApprovedArtist();
  try {
    await updateArtistProfile(userId, {
      displayName: input.displayName?.trim() || undefined,
      headline: input.headline?.trim() ?? null,
      city: input.city?.trim() ?? null,
      photoUrl: input.photoUrl?.trim() ?? null,
      bioHtml: input.bioHtml ?? null,
      payoutEmail: input.payoutEmail?.trim() || undefined,
      defaultCurrency: input.defaultCurrency,
      links: input.links,
    });
    revalidatePath("/studio/profile");
    revalidatePath(`/artists/${userId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type ArtworkFormInput = {
  title: string;
  descriptionHtml?: string;
  kind?: "original" | "limited_edition" | "open_edition";
  yearCreated?: number | null;
  medium?: string | null;
  style?: string | null;
  subject?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  certificateOfAuthenticity?: boolean;
  provenanceNotes?: string | null;
  /** Price in major units (dollars); converted to minor units here. */
  price: number;
  inventoryQty?: number;
  images: ArtworkMediaInput[];
};

function toMinor(price: number): number {
  return Math.max(0, Math.round(Number(price) * 100));
}

export async function createArtworkAction(
  input: ArtworkFormInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { userId } = await requireApprovedArtist();
  if (!input.title?.trim()) return { ok: false, error: "A title is required." };

  try {
    const { id } = await createArtwork({
      artistUserId: userId,
      title: input.title.trim(),
      descriptionHtml: input.descriptionHtml ?? null,
      kind: input.kind,
      yearCreated: input.yearCreated ?? null,
      medium: input.medium ?? null,
      style: input.style ?? null,
      subject: input.subject ?? null,
      heightCm: input.heightCm ?? null,
      widthCm: input.widthCm ?? null,
      depthCm: input.depthCm ?? null,
      certificateOfAuthenticity: input.certificateOfAuthenticity ?? false,
      provenanceNotes: input.provenanceNotes ?? null,
      priceMinor: toMinor(input.price),
      inventoryQty: input.inventoryQty ?? 1,
      images: input.images,
    });
    revalidatePath("/studio");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateArtworkAction(
  artworkId: string,
  input: ArtworkFormInput
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireApprovedArtist();
  try {
    await updateArtwork(artworkId, userId, {
      title: input.title?.trim() || undefined,
      descriptionHtml: input.descriptionHtml ?? null,
      kind: input.kind,
      yearCreated: input.yearCreated ?? null,
      medium: input.medium ?? null,
      style: input.style ?? null,
      subject: input.subject ?? null,
      heightCm: input.heightCm ?? null,
      widthCm: input.widthCm ?? null,
      depthCm: input.depthCm ?? null,
      certificateOfAuthenticity: input.certificateOfAuthenticity ?? false,
      provenanceNotes: input.provenanceNotes ?? null,
      priceMinor: toMinor(input.price),
      inventoryQty: input.inventoryQty ?? undefined,
    });
    await setArtworkMedia(artworkId, userId, input.images);
    revalidatePath("/studio");
    revalidatePath(`/studio/artworks/${artworkId}/edit`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function publishArtworkAction(
  artworkId: string
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireApprovedArtist();
  try {
    await publishArtwork(artworkId, userId);
    revalidatePath("/studio");
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function archiveArtworkAction(
  artworkId: string
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireApprovedArtist();
  try {
    await archiveArtwork(artworkId, userId);
    revalidatePath("/studio");
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
