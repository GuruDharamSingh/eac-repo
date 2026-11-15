"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getArtworkForEdit } from "@elkdonis/commerce/queries";
import { createArtwork, publishArtwork, setArtworkMedia, updateArtwork } from "@elkdonis/commerce/server";
import type { Artwork, ArtworkKind, Currency } from "@elkdonis/commerce/types";
import type { ArtworkContextView, ArtworkInputView, ArtworkRecordView } from "@elkdonis/studio-forms";
import { siteConfig } from "@/config/site";
import { guardStore } from "@/lib/manage";
import { UUID_RE } from "@/lib/shop";
import { getShippingMode } from "@/lib/shipping/settings";

/**
 * Server side of the Artwork quick form on katie's /channel (2026-11-12).
 *
 * Thin wrappers over commerce's createArtwork / updateArtwork / setArtworkMedia /
 * publishArtwork, the paths /manage/pieces uses (lib/manage-actions.ts savePieceAction),
 * so a piece saved here is the row the console edits. Nothing here creates a Stripe
 * object: commerce's artwork functions write rows only.
 *
 * Who may act: guardStore (lib/manage.ts), the console's own rule: an owner or guide of
 * siteConfig.orgId who is also the store's owner or on its team, with the store active.
 * The viewer comes from the session, never from a parameter. The org is always
 * siteConfig.orgId: the `orgId` the client sends is checked against it and otherwise
 * ignored. The store is the site's pinned store, not one the form names.
 *
 * Differences from savePieceAction, on purpose: the quick form does not carry style,
 * weight or the inventory count, so those are left unsent (commerce keeps a column whose
 * input is undefined); a new piece gets quantity 1. Pieces that are reserved or sold are
 * not changed here (an order stands behind them). Publishing keeps the console's shipping
 * rule (a size and weight are needed while shipping is on).
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const KINDS: ArtworkKind[] = ["original", "limited_edition", "open_edition"];
// Every currency commerce prices in (types/index.ts Currency); the console takes the same list
// (manage-actions.ts CURRENCIES). Widened from CAD/USD on the developer's word, 2026-11-12.
const CURRENCIES: Currency[] = ["CAD", "USD", "EUR", "GBP"];
const asCurrency = (v: unknown): Currency => (CURRENCIES.includes(v as Currency) ? (v as Currency) : "CAD");
const WRONG_ORG = "This form is for Katie the Potter only.";
const NEEDS_SIZE_AND_WEIGHT =
  "Shipping is switched on, so a piece needs its height, width and weight before it goes on sale. Add them in the console under Size and weight, then put it on sale again.";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const whole = (n: unknown, min: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= 100000;

function toRecord(a: Artwork): ArtworkRecordView {
  const variant = [...(a.variants ?? [])].sort((x, y) => x.position - y.position)[0];
  const media = [...(a.media ?? [])].sort((x, y) => x.position - y.position);
  const listed = a.status === "available" || a.status === "reserved" || a.status === "sold";
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    status: listed ? "published" : a.status === "archived" ? "archived" : "draft",
    artworkStatus: a.status,
    publishedAt: listed ? a.updatedAt : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    input: {
      title: a.title,
      descriptionHtml: a.descriptionHtml ?? null,
      kind: a.kind,
      yearCreated: a.yearCreated ?? null,
      medium: a.medium ?? null,
      heightCm: a.heightCm ?? null,
      widthCm: a.widthCm ?? null,
      depthCm: a.depthCm ?? null,
      priceMinor: variant?.priceMinor ?? 0,
      currency: asCurrency(variant?.currency),
      creditedArtistUserId: null,
      certificateOfAuthenticity: Boolean(a.certificateOfAuthenticity),
      images: media.map((m) => ({ url: m.url, alt: m.alt ?? null })),
      editionTotal: a.kind === "limited_edition" ? (variant?.editionTotal ?? null) : null,
      stock: variant ? variant.inventoryQty : null,
      availability: listed ? (a.status as "available" | "reserved" | "sold") : null,
    },
    href: listed ? `/pieces/${a.slug || a.id}` : null,
  };
}

/** What the form needs to know: whether this person may save here, and the seller's name. */
export async function channelArtworkContextAction(orgId: string): Promise<ArtworkContextView> {
  const base: ArtworkContextView = {
    canEdit: false,
    reason: "Sign in as an editor of this site.",
    viewerId: null,
    viewerName: "",
    storeName: null,
    defaultCurrency: "CAD",
    currencies: CURRENCIES as ArtworkContextView["currencies"],
    makerCandidates: [],
  };
  if (orgId !== siteConfig.orgId) return { ...base, reason: WRONG_ORG };
  const g = await guardStore();
  if ("message" in g) return { ...base, reason: g.message };
  const name = g.store.displayName ?? siteConfig.orgName;
  const maker = g.store.ownerUserId ?? g.viewer.userId;
  return {
    ...base,
    canEdit: true,
    reason: null,
    viewerId: g.viewer.userId,
    viewerName: name,
    storeName: name,
    defaultCurrency: asCurrency(g.store.defaultCurrency),
    makerCandidates: [{ userId: maker, displayName: name }],
  };
}

/** A piece of this site's store, as the form record; null when it is not in this store or the viewer may not act. */
export async function channelArtworkLoadAction(id: string): Promise<ArtworkRecordView | null> {
  const g = await guardStore();
  if ("message" in g || !UUID_RE.test(id)) return null;
  const a = await getArtworkForEdit(id, g.viewer.userId).catch(() => null);
  return a && a.storeId === g.store.id ? toRecord(a) : null;
}

export async function channelArtworkSaveAction(
  orgId: string,
  input: ArtworkInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<Result<{ record: ArtworkRecordView; warnings: string[]; notPublished: string | null }>> {
  if (orgId !== siteConfig.orgId) return { ok: false, error: WRONG_ORG };
  const g = await guardStore();
  if ("message" in g) return { ok: false, error: g.message };

  const title = text(input?.title, 200);
  if (title.length < 2) return { ok: false, error: "Give the piece a title." };
  if (!CURRENCIES.includes(input.currency)) return { ok: false, error: "Pick the price in CAD, USD, EUR or GBP." };
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick original, edition or open edition." };
  const priceMinor = Number.isFinite(input.priceMinor) ? Math.max(0, Math.min(100_000_000, Math.round(input.priceMinor))) : 0;
  if (id && !UUID_RE.test(id)) return { ok: false, error: "That piece is not in this store." };

  // Only pictures that went through this site's own upload route (manage-actions.ts cleanImages).
  const rawImages = Array.isArray(input.images) ? input.images : [];
  if (rawImages.length > 12) return { ok: false, error: "At most 12 pictures." };
  const media: Array<{ url: string; alt: string | null; role: "hero" | "detail" }> = [];
  for (const [i, im] of rawImages.entries()) {
    const url = text(im?.url, 600);
    if (!url) continue;
    if (!url.startsWith("/api/media/EAC_Network/") || url.includes("..")) {
      return { ok: false, error: "One of the pictures is not from this site's library. Upload it again." };
    }
    media.push({ url, alt: text(im?.alt, 200) || title, role: i === 0 ? "hero" : "detail" });
  }
  if (input.stock !== null && input.stock !== undefined && !whole(input.stock, 1)) {
    return { ok: false, error: "Quantity is a whole number, 1 or more." };
  }

  const fields = {
    title,
    descriptionHtml: input.descriptionHtml?.trim() ? input.descriptionHtml.slice(0, 20_000) : null,
    kind: input.kind,
    yearCreated: typeof input.yearCreated === "number" && input.yearCreated >= 1000 && input.yearCreated <= 2200 ? input.yearCreated : null,
    medium: text(input.medium, 200) || null,
    heightCm: input.heightCm ?? null,
    widthCm: input.widthCm ?? null,
    depthCm: input.depthCm ?? null,
    priceMinor,
    currency: input.currency,
    certificateOfAuthenticity: input.certificateOfAuthenticity === true,
    ...(input.kind === "limited_edition" && input.editionTotal ? { editionTotal: input.editionTotal } : {}),
    ...(input.stock !== null && input.stock !== undefined ? { inventoryQty: input.stock } : {}),
  };

  const warnings: string[] = [];
  let artworkId = id;
  try {
    if (artworkId) {
      const [row] = await db<Array<{ status: string }>>`SELECT status FROM artwork WHERE id = ${artworkId} AND store_id = ${g.store.id} LIMIT 1`;
      if (!row) return { ok: false, error: "That piece is not in this store." };
      if (row.status === "reserved" || row.status === "sold") {
        return { ok: false, error: `This piece is ${row.status}, so changes are paused. It has an order behind it; handle that under Orders.` };
      }
      if (opts?.autosave && row.status !== "draft") {
        return { ok: false, error: "Not saved automatically: it is no longer a draft. Press Save to update it." };
      }
      if (row.status === "available" && media.length === 0) return { ok: false, error: "A piece on sale needs at least one picture." };
      const existing = await getArtworkForEdit(artworkId, g.viewer.userId);
      if (!existing) return { ok: false, error: "That piece is not yours to change." };
      await updateArtwork(artworkId, g.viewer.userId, fields);
      const before = [...(existing.media ?? [])].sort((x, y) => x.position - y.position).map((m) => `${m.url}|${m.alt ?? ""}`);
      const after = media.map((m) => `${m.url}|${m.alt}`);
      if (before.join("\n") !== after.join("\n")) await setArtworkMedia(artworkId, g.viewer.userId, media);
      if (intent === "draft" && row.status === "available" && !opts?.autosave) {
        warnings.push("It is still on sale: to take it down, use Shown as in the console.");
      }
    } else {
      const created = await createArtwork({
        storeId: g.store.id,
        actorUserId: g.viewer.userId,
        artistUserId: g.store.ownerUserId ?? g.viewer.userId,
        ...fields,
        images: media,
      });
      artworkId = created.id;
    }
  } catch (err) {
    console.error("[katie-the-potter] channelArtworkSaveAction:", err);
    const m = err instanceof Error ? err.message : "";
    return { ok: false, error: m && m.length < 200 && !/^\s*(select|insert|update|delete)\b/i.test(m) ? m : "Could not save that piece." };
  }

  let notPublished: string | null = null;
  if (intent === "published") {
    try {
      if (media.length === 0) throw new Error("Add at least one picture before putting a piece on sale.");
      if ((await getShippingMode().catch(() => "off")) !== "off") {
        const [d] = await db<Array<{ h: string | null; w: string | null; kg: string | null }>>`
          SELECT height_cm AS h, width_cm AS w, weight_kg AS kg FROM artwork WHERE id = ${artworkId} AND store_id = ${g.store.id}
        `;
        if (!Number(d?.h) || !Number(d?.w) || !Number(d?.kg)) throw new Error(NEEDS_SIZE_AND_WEIGHT);
      }
      await publishArtwork(artworkId, g.viewer.userId);
      // On sale again means no longer "portfolio only" (setShownAsAction "sale").
      await db`UPDATE artwork SET metadata = metadata - 'site' WHERE id = ${artworkId} AND store_id = ${g.store.id}`;
    } catch (err) {
      const m = err instanceof Error ? err.message : "It could not be put on sale.";
      notPublished = `Saved as a draft, not on sale: ${m}`;
    }
  }

  const saved = await getArtworkForEdit(artworkId, g.viewer.userId).catch(() => null);
  if (!saved) return { ok: false, error: "Saved, but the piece could not be read back." };

  revalidatePath("/");
  revalidatePath("/pieces/[slug]", "page");
  revalidatePath("/manage/pieces");
  revalidatePath(`/manage/pieces/${artworkId}`);
  return { ok: true, value: { record: toRecord(saved), warnings, notPublished } };
}
