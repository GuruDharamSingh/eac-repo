"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getSiteOwnerUserId, getViewer } from "@/lib/auth";

// ============================================================================
// Her artworks' two site-side switches: how a piece is shown, and its title.
//
// "How it is shown" is three states, mapped onto the marketplace's own
// listing status so there is still only ONE answer to "is it for sale":
//
//   sale        status 'available' — listed on the marketplace, price and an
//               enquire / buy link on her site.
//   portfolio   status 'archived' + metadata.site = 'portfolio' — off the
//               marketplace, still on her site as a picture of her work.
//   hidden      status 'archived', no site flag — nowhere.
//
// 'archived' is what the marketplace studio's own "unlist" writes, so a piece
// switched here reads correctly there and vice versa.
//
// Pieces that are SOLD or RESERVED are left alone: a reservation is an order
// in flight and a sale has an order behind it, and neither is this page's to
// undo. Those change in the marketplace, where the order is.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who may change her listings from here: Dana herself, or an OWNER of this
 * site. Not a guide — a guide edits pages, and these rows are her store's.
 */
async function authorise(): Promise<string | { error: string }> {
  const [viewer, artistId] = await Promise.all([getViewer(), getSiteOwnerUserId()]);
  if (!viewer || !artistId) return { error: "Sign in to change artworks." };
  if (viewer.userId !== artistId && viewer.role !== "owner") {
    return { error: "Only Dana (or an owner of this site) can change an artwork's details." };
  }
  return artistId;
}

/**
 * The form action (/manage/artworks). Throws on refusal, as a form action has
 * nowhere else to put an error.
 */
export async function updateArtwork(formData: FormData): Promise<void> {
  const res = await changeArtwork(formData);
  if ("error" in res) throw new Error(res.error);
}

/**
 * The same change, returning its outcome — for callers that show the reason
 * (the Galleries panel). A thrown message is masked in production builds.
 */
export async function changeArtwork(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await authorise();
  if (typeof who !== "string") return { ok: false, error: who.error };
  const artistId = who;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { ok: false, error: "Unknown artwork." };
  const mode = String(formData.get("mode") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);

  // Every write is scoped to HER pieces in the same statement, so a forged id
  // for somebody else's artwork matches no row.
  if (title) {
    await db`
      UPDATE artwork
      SET title = ${title},
          metadata = metadata || '{"title_confirmed": true}'::jsonb
      WHERE id = ${id} AND artist_user_id = ${artistId}
    `;
  }

  if (mode === "sale") {
    await db`
      UPDATE artwork
      SET status = 'available', metadata = metadata - 'site'
      WHERE id = ${id} AND artist_user_id = ${artistId}
        AND status IN ('available', 'archived', 'draft')
    `;
  } else if (mode === "portfolio") {
    await db`
      UPDATE artwork
      SET status = 'archived', metadata = metadata || '{"site": "portfolio"}'::jsonb
      WHERE id = ${id} AND artist_user_id = ${artistId}
        AND status IN ('available', 'archived', 'draft')
    `;
  } else if (mode === "hidden") {
    await db`
      UPDATE artwork
      SET status = 'archived', metadata = metadata - 'site'
      WHERE id = ${id} AND artist_user_id = ${artistId}
        AND status IN ('available', 'archived', 'draft')
    `;
  }

  // Every page can hold an Artworks block; they are all dynamic, so this is
  // for the manage page's own list.
  revalidatePath("/manage/artworks");
  return { ok: true };
}
