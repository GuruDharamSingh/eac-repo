"use server";

/**
 * Cataloguing work from the network host (the artwork surface). Writes go
 * through commerce's own paths — `createArtwork`, `updateArtwork`,
 * `publishArtwork` — so a piece started here is the row the marketplace
 * studio edits. Ported from apps/ifac/src/lib/cms/artwork-actions.ts (2026-10-29).
 */

import { revalidatePath } from "next/cache";
import { createArtwork, updateArtwork, publishArtwork, canClaimStore } from "@elkdonis/commerce/server";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { ArtworkKind } from "@elkdonis/commerce/types";
import { getCurrentUser } from "@/lib/session";

const MARKET_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

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
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed-out" };
  const store = await getStoreForUser(user.id).catch(() => null);
  if (!store) return { ok: false, reason: "no-store", canOpenStore: await canClaimStore(user.id) };
  if (store.status !== "active") return { ok: false, reason: "store-pending" };
  return { ok: true };
}

export async function saveArtworkDraftAction(input: ArtworkDraftInput, id?: string | null): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
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
      await updateArtwork(id, user.id, fields);
      return { ok: true, id };
    }
    const created = await createArtwork({
      artistUserId: user.id,
      actorUserId: user.id,
      ...fields,
      images: input.imageUrl?.trim() ? [{ url: input.imageUrl.trim(), role: "hero", alt: title }] : [],
    });
    return { ok: true, id: created.id };
  } catch (error) {
    console.error("[learn] saveArtworkDraftAction:", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message.includes("store") ? message : "Could not save that piece." };
  }
}

export async function publishArtworksAction(ids: string[]): Promise<{ ok: true; urls?: string[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const links = marketplaceLinks(MARKET_URL, { from: "arts-collective", handoff: true });
  const urls: string[] = [];
  try {
    for (const id of ids.slice(0, 50)) {
      await publishArtwork(id, user.id);
      urls.push(links.artwork(id));
    }
    revalidatePath("/learn", "layout");
    revalidatePath("/hub", "layout");
    return { ok: true, urls };
  } catch (error) {
    console.error("[learn] publishArtworksAction:", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message || "Could not publish." };
  }
}
