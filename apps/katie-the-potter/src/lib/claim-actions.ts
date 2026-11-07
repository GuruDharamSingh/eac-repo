"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { forgetSiteOwner, getApiEditor, getSiteArtistUserId, getViewer } from "@/lib/auth";
import { ensurePictureFolder } from "@/lib/site-store";
import { forgetSiteStore } from "@/lib/artworks";
import { siteOrigin } from "@/lib/origin";
import { ClaimRefused, createClaimToken, redeemClaim, revokeClaimTokens } from "@/lib/manage-claim";

// Thin actions over lib/manage-claim.ts. Who may CREATE a link: an owner of
// this site's org, or a network admin. Who may REDEEM: anyone signed in who
// holds the link (that is what the link is for).

export type ClaimLinkResult = { ok: true; message: string; url: string; expiresAt: string } | { ok: false; message: string };

async function mayHandOver(): Promise<string | null> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return null;
  if (viewer.role === "owner") return viewer.userId;
  return (await isAdmin(viewer.userId).catch(() => false)) ? viewer.userId : null;
}

/** Create the one-time link (replacing any earlier unused one). The URL is returned once and never stored. */
export async function createClaimLinkAction(): Promise<ClaimLinkResult> {
  const actor = await mayHandOver();
  if (!actor) return { ok: false, message: "Only an owner of this site (or a network admin) can create a hand-over link." };
  try {
    const { token, expiresAt } = await createClaimToken(siteConfig.orgId, actor);
    revalidatePath("/manage/people");
    return { ok: true, message: "Link created. Copy it now: it is shown only once.", url: `${await siteOrigin()}/claim/${token}`, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    console.error("[katie-the-potter] createClaimLinkAction:", err);
    return { ok: false, message: "We couldn't create the link. Please try again." };
  }
}

export async function revokeClaimLinksAction(): Promise<{ ok: boolean; message: string }> {
  const actor = await mayHandOver();
  if (!actor) return { ok: false, message: "Only an owner of this site (or a network admin) can do that." };
  const n = await revokeClaimTokens(siteConfig.orgId);
  revalidatePath("/manage/people");
  return { ok: true, message: n ? "The link no longer works." : "There was no open link." };
}

/** Redeem a link for the signed-in person. Returns a message; the page redirects on success. */
export async function redeemClaimAction(token: string): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return { ok: false, message: "Please sign in first." };
  try {
    const r = await redeemClaim(token, viewer.userId);
    forgetSiteOwner();
    forgetSiteStore();
    // After the commit, never inside it: gainSpace has side effects outside
    // the database (Nextcloud folders) and is idempotent. Her picture folder
    // (and the collective membership a store needs) is made here; if it fails
    // the claim still stands, and /manage offers "Finish setting up your
    // picture folder", which runs it again (finishPictureFolderAction).
    const folderReady = await ensurePictureFolder(viewer.userId);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        (r.storeId
          ? `The shop is yours: you own the site and its store${r.artworksMoved ? `, and ${r.artworksMoved} piece${r.artworksMoved === 1 ? " is" : "s are"} now credited to you` : ""}.`
          : "You now own the site.") + (folderReady ? "" : " Your picture folder isn't ready yet; you can finish it from the Overview."),
    };
  } catch (err) {
    if (err instanceof ClaimRefused) return { ok: false, message: err.message };
    console.error("[katie-the-potter] redeemClaimAction:", err);
    return { ok: false, message: "We couldn't complete the hand-over. Nothing was changed; please try again." };
  }
}

/**
 * "Finish setting up your picture folder": run gainSpace again for the
 * artist (the site store's owner). Idempotent, so pressing it twice is safe.
 */
export async function finishPictureFolderAction(): Promise<{ ok: boolean; message: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, message: "Please sign in as an editor of this site." };
  const artist = await getSiteArtistUserId();
  if (!artist) return { ok: false, message: "This site has no owner yet." };
  const ready = await ensurePictureFolder(artist);
  revalidatePath("/manage");
  return ready
    ? { ok: true, message: "Your picture folder is ready. You can add pictures now." }
    : { ok: false, message: "We still couldn't make the picture folder. Please try again in a minute, or tell Justin." };
}
