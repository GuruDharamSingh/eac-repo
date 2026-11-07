"use server";

import { redirect } from "next/navigation";
import { createSocialPost, updateSocialPost } from "@elkdonis/services";
import { getArtworkById } from "@elkdonis/commerce/queries";
import { requireUser } from "@/lib/session";
import { loadChannel, PERSONAL_ORG_ID } from "@/lib/channel-data";

// ============================================================================
// "Post this" on a Channel artwork row: a draft Post (social_posts) filled
// from the piece (title, a line of details, its picture, a link to its page),
// then the Studio's Post kind opens on it. Nothing is sent to any platform
// here: the person reviews the draft and presses Post to themselves.
// ============================================================================

function back(orgId: string | null, notice: string): never {
  const q = new URLSearchParams({ view: "artwork", notice });
  if (orgId) q.set("org", orgId);
  redirect(`/studio/channel?${q.toString()}`);
}

export async function postArtworkAction(form: FormData): Promise<void> {
  const user = await requireUser("/login?next=/studio/channel");
  const artworkId = String(form.get("artworkId") ?? "");
  const orgParam = String(form.get("orgId") ?? "") || undefined;

  // Re-derive the channel the same way the page does, so the piece must be one
  // the page would list for this person and org (no trust in the form).
  const channel = await loadChannel(user, { org: orgParam, view: "artwork" });
  const orgId = channel.org?.orgId ?? null;
  const row = channel.artworks.find((a) => a.id === artworkId);
  if (!row) back(orgId, "That piece is not in this channel.");

  const piece = await getArtworkById(artworkId, { includeUnlisted: true }).catch(() => null);
  if (!piece) back(orgId, "That piece could not be read.");

  const details = [piece.medium, piece.yearCreated ? String(piece.yearCreated) : null, row.priceLabel].filter(Boolean).join(" · ");
  const body = [piece.title, details].filter(Boolean).join("\n");
  const images = row.imageUrl && row.imageUrl.startsWith("/api/media/") ? [{ url: row.imageUrl, alt: row.imageAlt ?? piece.title }] : [];

  let postId: string;
  try {
    const post = await createSocialPost(user.id, orgId ?? PERSONAL_ORG_ID);
    await updateSocialPost(user.id, post.id, { title: piece.title, body, link: row.href, images });
    postId = post.id;
  } catch (err) {
    console.error("[channel] postArtworkAction:", err instanceof Error ? err.message : err);
    back(orgId, "The draft post could not be made. Try again, or start one from Posts.");
  }

  const q = new URLSearchParams({ kind: "post", id: postId });
  if (orgId) q.set("org", orgId);
  redirect(`/studio?${q.toString()}`);
}
