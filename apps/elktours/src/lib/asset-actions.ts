"use server";
// CONTRACT: asset server actions (editor-only). Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { archiveAsset, copyPlaceAssetToStop, getAsset, importPhotoToOrg, listAssets, setAssetVisible, upsertAsset } from "@/lib/assets";
import { listUserMediaLibrary } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { AssetInput, AssetScope, Result, TourAsset } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;

/** Revalidate the public pages the asset shows on. */
async function revalidateFor(asset: TourAsset | null) {
  revalidatePath("/");
  revalidatePath("/tours");
  if (!asset?.threadId) {
    if (asset?.placeId) revalidatePath(`/manage/places/${asset.placeId}`);
    return;
  }
  const [t] = (await db`SELECT slug, kind FROM threads WHERE id = ${asset.threadId} AND org_id = ${ORG}`) as unknown as { slug: string; kind: string }[];
  if (!t) return;
  if (t.kind === "experience") {
    revalidatePath("/experiences");
    revalidatePath(`/experiences/${t.slug}`);
  } else {
    revalidatePath(`/tours/${t.slug}`);
    revalidatePath(`/manage/tours/${asset.threadId}/assets`);
  }
}

const fail = (err: unknown, fallback: string): { ok: false; error: string } => {
  console.error("[elktours] asset action:", err);
  return { ok: false, error: err instanceof Error ? err.message : fallback };
};

export async function listAssetsAction(scope: AssetScope): Promise<TourAsset[]> {
  await requireOrgEditor();
  return listAssets(scope);
}

/** The per-asset visible switch. Showing a Private/ file copies it to public Media/ first; showing a hero film rewrites metadata.film. */
export async function setAssetVisibleAction(id: string, visible: boolean): Promise<Result<{ asset: TourAsset }>> {
  await requireOrgEditor();
  try {
    const asset = await setAssetVisible(id, visible);
    await revalidateFor(asset);
    return { ok: true, asset };
  } catch (err) {
    return fail(err, "Could not change the asset.");
  }
}

export async function upsertAssetAction(input: AssetInput): Promise<Result<{ asset: TourAsset }>> {
  const viewer = await requireOrgEditor();
  try {
    const asset = await upsertAsset(input, viewer.userId);
    await revalidateFor(asset);
    return { ok: true, asset };
  } catch (err) {
    return fail(err, "Could not save the asset.");
  }
}

export async function archiveAssetAction(id: string): Promise<Result> {
  await requireOrgEditor();
  try {
    const before = await getAsset(id);
    await archiveAsset(id);
    await revalidateFor(before);
    return { ok: true };
  } catch (err) {
    return fail(err, "Could not archive the asset.");
  }
}

/** Offer a catalogue (place) asset to a stop: copies it into a stop row (same url, meta.fromPlaceAssetId), hidden. */
export async function copyPlaceAssetToStopAction(placeAssetId: string, stopId: string): Promise<Result<{ asset: TourAsset }>> {
  const viewer = await requireOrgEditor();
  try {
    const asset = await copyPlaceAssetToStop(placeAssetId, stopId, viewer.userId);
    await revalidateFor(asset);
    return { ok: true, asset };
  } catch (err) {
    return fail(err, "Could not add the asset to the stop.");
  }
}

/**
 * Add a photo to a tour's gallery from the phone media screen's picker (2026-11-17): an upload or a picture from this
 * site's library is used as it is; a picture from the person's own files ("My files") must be in their library and is
 * copied into the site's Media/Images first. The photo is switched on at once (a Private/ file is published by
 * setAssetVisible). Owners add to any tour; guides only to tours they wrote.
 */
export async function addTourPhotoAction(tourId: string, url: string): Promise<Result<{ asset: TourAsset }>> {
  const viewer = await requireOrgEditor();
  const clean = typeof url === "string" ? url.trim() : "";
  if (!clean) return { ok: false, error: "Choose a picture first." };
  const [t] = (await db`SELECT author_id FROM threads WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour'`) as unknown as { author_id: string }[];
  if (!t) return { ok: false, error: "That tour is not on this site." };
  if (viewer.role !== "owner" && t.author_id !== viewer.userId) return { ok: false, error: "That tour is not yours." };
  try {
    let fileUrl = clean;
    const ours = clean.startsWith(`/api/media/EAC_Network/${ORG}/`) || clean.startsWith("https://");
    if (!ours) {
      const mine = await listUserMediaLibrary(viewer.userId);
      if (!mine.some((m) => m.url === clean)) return { ok: false, error: "That picture is not one of your files." };
      fileUrl = await importPhotoToOrg(clean);
    }
    const added = await upsertAsset({ threadId: tourId, stopId: null, kind: "image", role: "gallery", url: fileUrl, source: ours ? "library" : "my-files", visible: false }, viewer.userId);
    const asset = await setAssetVisible(added.id, true);
    await revalidateFor(asset);
    return { ok: true, asset };
  } catch (err) {
    return fail(err, "Could not add the photo.");
  }
}
