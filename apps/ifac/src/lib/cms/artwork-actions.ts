"use server";

/**
 * Cataloguing work from Center, several pieces in one sitting (the artwork
 * surface, 2026-10-18). Writes go through commerce's own paths — `createArtwork`,
 * `updateArtwork`, `publishArtwork` — so a piece started here is the same row
 * the marketplace studio edits. This file supplies who is asking and the
 * store gate; the first save of a piece creates it as a draft, later saves
 * update it, and "Publish all" publishes the drafts.
 */

import { revalidatePath } from "next/cache";
import { createArtwork, updateArtwork, publishArtwork, canClaimStore } from "@elkdonis/commerce/server";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { ArtworkKind } from "@elkdonis/commerce/types";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export interface ArtworkDraftInput {
  title: string;
  imageUrl: string;
  medium: string;
  yearCreated: string;
  heightCm: string;
  widthCm: string;
  kind: "original" | "limited_edition" | "open_edition";
  price: string;
  descriptionHtml: string;
}

function num(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function checkStoreAction(): Promise<{ ok: boolean; reason?: string; canOpenStore?: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "signed-out" };
  const store = await getStoreForUser(viewer.userId).catch(() => null);
  if (!store) return { ok: false, reason: "no-store", canOpenStore: await canClaimStore(viewer.userId) };
  if (store.status !== "active") return { ok: false, reason: "store-pending" };
  return { ok: true };
}

export async function saveArtworkDraftAction(
  input: ArtworkDraftInput,
  id?: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const title = (input.title ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give the piece a title." };
  const fields = {
    title,
    descriptionHtml: input.descriptionHtml?.trim() ? `<p>${input.descriptionHtml.trim().replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : null,
    kind: (input.kind ?? "original") as ArtworkKind,
    medium: input.medium?.trim() || null,
    yearCreated: num(input.yearCreated),
    heightCm: num(input.heightCm),
    widthCm: num(input.widthCm),
    // Minor units; blank is "price on request".
    priceMinor: Math.max(0, Math.round((num(input.price) ?? 0) * 100)),
  };
  try {
    if (id) {
      await updateArtwork(id, viewer.userId, fields);
      return { ok: true, id };
    }
    const created = await createArtwork({
      artistUserId: viewer.userId,
      actorUserId: viewer.userId,
      ...fields,
      images: input.imageUrl?.trim() ? [{ url: input.imageUrl.trim(), role: "hero", alt: title }] : [],
    });
    return { ok: true, id: created.id };
  } catch (error) {
    console.error("[ifac] saveArtworkDraftAction:", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message.includes("store") ? message : "Could not save that piece." };
  }
}

export async function publishArtworksAction(ids: string[]): Promise<{ ok: true; urls?: string[] } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const links = marketplaceLinks(siteConfig.marketplaceUrl, { from: "ifac", handoff: true });
  const urls: string[] = [];
  try {
    for (const id of ids.slice(0, 50)) {
      await publishArtwork(id, viewer.userId);
      urls.push(links.artwork(id));
    }
    revalidatePath("/center");
    revalidatePath("/hub");
    return { ok: true, urls };
  } catch (error) {
    console.error("[ifac] publishArtworksAction:", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message || "Could not publish." };
  }
}
