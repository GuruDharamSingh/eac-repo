"use server";

import { createArtwork, publishArtwork, setArtworkMedia, updateArtwork } from "@elkdonis/commerce/server";
import { getArtworkForEdit, getStoreForUser, listMyArtworks } from "@elkdonis/commerce/queries";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { Artwork, ArtworkKind, Currency } from "@elkdonis/commerce/types";
import type { StudioResult } from "@elkdonis/studio";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";

/**
 * The publication forms' Artwork, on arts-collective (pass 2, 2026-11-08).
 * Writes go through commerce's own paths (createArtwork, updateArtwork,
 * setArtworkMedia, publishArtwork), as lib/cms/artwork-actions.ts does, so a
 * piece made here is the row the marketplace studio edits. The store and the
 * artist are the signed-in person's own (their oldest active store, as
 * createArtwork resolves it); the form never names a store. Bound to
 * studio/forms adapters/artwork.ts ArtworkActions. Not imported anywhere
 * until the PM's go.
 *
 * Not one transaction: createArtwork is one (piece + Default variant +
 * pictures), publishArtwork another. An edit is updateArtwork, then
 * setArtworkMedia when the pictures changed, then publishArtwork: three. A
 * publish that fails (no picture, or the keepers hid the piece) leaves the
 * saved draft and comes back as `notPublished`.
 */

const MARKET_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";
const CURRENCIES: Currency[] = ["CAD", "USD", "EUR", "GBP"];
const KINDS: ArtworkKind[] = ["original", "limited_edition", "open_edition"];

/** Structurally studio/forms adapters/artwork.ts ArtworkInputView. */
interface ArtworkFormInput {
  title: string;
  descriptionHtml: string | null;
  kind: ArtworkKind;
  yearCreated: number | null;
  medium: string | null;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  priceMinor: number;
  currency: Currency;
  creditedArtistUserId: string | null;
  certificateOfAuthenticity: boolean;
  images: Array<{ url: string; alt: string | null }>;
}

/** Structurally ArtworkRecordView. */
interface ArtworkFormRecord {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  artworkStatus: Artwork["status"];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: ArtworkFormInput;
  href: string | null;
}

interface ArtworkFormContext {
  canEdit: boolean;
  reason: string | null;
  viewerId: string | null;
  viewerName: string;
  storeName: string | null;
  defaultCurrency: Currency;
  currencies: Currency[];
  makerCandidates: Array<{ userId: string; displayName: string }>;
}

async function viewerId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

function mediaUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function toRecord(a: Artwork): ArtworkFormRecord {
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
      currency: variant?.currency ?? "CAD",
      creditedArtistUserId: a.creditedArtistUserId ?? null,
      certificateOfAuthenticity: Boolean(a.certificateOfAuthenticity),
      images: media.map((m) => ({ url: m.url, alt: m.alt ?? null })),
    },
    href: listed ? marketplaceLinks(MARKET_URL, { from: "arts-collective", handoff: true }).artwork(a.id) : null,
  };
}

export async function artworkFormContextAction(_orgId: string): Promise<ArtworkFormContext> {
  const viewer = await viewerId();
  const base: ArtworkFormContext = {
    canEdit: false,
    reason: "Sign in first.",
    viewerId: viewer,
    viewerName: "",
    storeName: null,
    defaultCurrency: "CAD",
    currencies: CURRENCIES,
    makerCandidates: [],
  };
  if (!viewer) return base;
  const [store, [user]] = await Promise.all([
    getStoreForUser(viewer).catch(() => null),
    db<Array<{ display_name: string | null; email: string | null }>>`SELECT display_name, email FROM users WHERE id = ${viewer}`.catch(
      () => [] as Array<{ display_name: string | null; email: string | null }>
    ),
  ]);
  const viewerName = user?.display_name || user?.email || "You";
  const ready = store?.status === "active";
  return {
    ...base,
    canEdit: ready,
    reason: !store ? "You don’t have a store here yet. Open one on the marketplace first." : ready ? null : "Your store is not approved yet.",
    viewerName,
    storeName: store?.displayName ?? null,
    defaultCurrency: store?.defaultCurrency ?? "CAD",
    makerCandidates: [{ userId: viewer, displayName: viewerName }],
  };
}

export async function loadArtworkFormAction(id: string): Promise<ArtworkFormRecord | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const a = await getArtworkForEdit(id, viewer).catch(() => null);
  return a ? toRecord(a) : null;
}

export async function listArtworkFormAction(): Promise<Array<{ id: string; updatedAt: string }>> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const list = await listMyArtworks(viewer).catch(() => [] as Artwork[]);
  return list.map((a) => ({ id: a.id, updatedAt: a.updatedAt }));
}

export async function saveArtworkFormAction(
  _orgId: string,
  input: ArtworkFormInput,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<StudioResult<{ record: ArtworkFormRecord; warnings: string[]; notPublished: string | null }>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };

  const title = (input.title ?? "").trim().slice(0, 200);
  if (title.length < 2) return { ok: false, error: "Give the piece a title." };
  if (!CURRENCIES.includes(input.currency)) return { ok: false, error: "Pick the price in CAD, USD, EUR or GBP." };
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick original, edition or open edition." };
  const priceMinor = Number.isFinite(input.priceMinor) ? Math.max(0, Math.round(input.priceMinor)) : 0;
  const images = (input.images ?? []).filter((im) => im && typeof im.url === "string" && im.url.trim()).slice(0, 24);
  if (images.some((im) => !mediaUrl(im.url.trim()))) return { ok: false, error: "A picture needs an address starting with https:// or /." };

  const warnings: string[] = [];
  // Pass 2 lists in the person's own store: they are the artist (artistUserId). Crediting
  // someone else is the org-store case (creditedArtistUserId, migration 209), not offered here.
  let credited: string | null = input.creditedArtistUserId || null;
  if (credited === viewer) credited = null;
  if (credited) {
    warnings.push("Crediting another artist is for an organisation’s store; it was not saved.");
    credited = null;
  }

  const fields = {
    title,
    descriptionHtml: input.descriptionHtml?.trim() || null,
    kind: input.kind,
    yearCreated: input.yearCreated ?? null,
    medium: input.medium?.trim() || null,
    heightCm: input.heightCm ?? null,
    widthCm: input.widthCm ?? null,
    depthCm: input.depthCm ?? null,
    priceMinor,
    currency: input.currency,
    certificateOfAuthenticity: input.certificateOfAuthenticity === true,
    creditedArtistUserId: credited,
  };
  const media = images.map((im, i) => ({ url: im.url.trim(), alt: im.alt?.trim() || title, role: i === 0 ? ("hero" as const) : ("detail" as const) }));

  let artworkId = id;
  try {
    if (artworkId) {
      const existing = await getArtworkForEdit(artworkId, viewer);
      if (!existing) return { ok: false, error: "That piece is not yours to change." };
      if (opts?.autosave && existing.status !== "draft") {
        return { ok: false, error: "Not saved automatically: it is no longer a draft. Press Save to update it." };
      }
      if (existing.status !== "draft" && media.length === 0) {
        return { ok: false, error: "A piece in the store needs at least one picture." };
      }
      await updateArtwork(artworkId, viewer, fields);
      const before = [...(existing.media ?? [])].sort((x, y) => x.position - y.position).map((m) => `${m.url}|${m.alt ?? ""}`);
      const after = media.map((m) => `${m.url}|${m.alt}`);
      if (before.join("\n") !== after.join("\n")) await setArtworkMedia(artworkId, viewer, media);
      if (intent === "draft" && existing.status !== "draft" && !opts?.autosave) {
        warnings.push("It is still in the store: taking a piece down is Archive, in the store.");
      }
    } else {
      const created = await createArtwork({ artistUserId: viewer, actorUserId: viewer, ...fields, images: media });
      artworkId = created.id;
    }
  } catch (error) {
    console.error("[studio] saveArtworkFormAction:", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: /store|credit|list work/i.test(message) ? message : "Could not save that piece." };
  }

  let notPublished: string | null = null;
  if (intent === "published") {
    try {
      await publishArtwork(artworkId, viewer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "It could not be published.";
      notPublished = `Saved as a draft, not published: ${message}`;
    }
  }

  const saved = await getArtworkForEdit(artworkId, viewer).catch(() => null);
  if (!saved) return { ok: false, error: "Saved, but the piece could not be read back." };
  return { ok: true, value: { record: toRecord(saved), warnings, notPublished } };
}
