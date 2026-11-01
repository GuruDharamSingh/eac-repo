"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateSeries,
  setSeriesStatus,
  searchSeriesPeople,
  setSeriesMemberById,
  removeSeriesMember,
  addSeriesLot,
  saveWeek,
  addWeekItem,
  removeWeekItem,
  approveWeekItem,
  setWeekFeatured,
  searchRepostable,
  submitOwnPiece,
  removeLotFromSeries,
  renumberSeriesLots,
  addLotToSeries,
  ensureSeriesThread,
  syncSeriesThread,
  listCollectiveArtists,
  listSeriesLibraries,
  listSeriesLibraryItems,
  listArtistListings,
  addListingToSeries,
  searchOrgs,
  addSeriesOrg,
  setSeriesOrgConversation,
  removeSeriesOrg,
  emailSeriesOrgInvitation,
  type ArtistListing,
  type SeriesLibrary,
  type SeriesInput,
  type SeriesPerson,
  type AddWeekItemInput,
  type WeekItemThread,
} from "@elkdonis/commerce/server";
import { startConversation } from "@elkdonis/messaging/server";
import { getCurrentUserId, getCurrentUser } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

// Server actions of the series workspace (/series/[slug]/manage). Every
// service call re-checks canEditSeries for the signed-in person.

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

async function actor(slug: string): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) redirect(`/login?next=/series/${slug}/manage`);
  return id;
}

function touch(slug: string) {
  revalidatePath(`/series/${slug}`, "layout");
  revalidatePath("/admin/series");
  revalidatePath("/");
}

export async function saveSeriesAction(seriesId: string, slug: string, input: SeriesInput): Promise<Result> {
  try {
    await updateSeries(seriesId, await actor(slug), input);
    await syncSeriesThread(seriesId).catch(() => undefined);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setStatusAction(seriesId: string, slug: string, status: "draft" | "published" | "closed"): Promise<Result> {
  try {
    await setSeriesStatus(seriesId, await actor(slug), status);
    // Publishing opens the series' forum thread (discussion, following).
    if (status === "published") await ensureSeriesThread(seriesId).catch((err) => console.error("[series] thread:", err));
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function searchPeopleAction(seriesId: string, slug: string, q: string): Promise<SeriesPerson[]> {
  return searchSeriesPeople(seriesId, await actor(slug), q);
}

export async function addMemberAction(seriesId: string, slug: string, userId: string, role: "editor" | "contributor"): Promise<Result> {
  try {
    const r = await setSeriesMemberById(seriesId, await actor(slug), userId, role);
    if (r.ok) touch(slug);
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function removeMemberAction(seriesId: string, slug: string, userId: string): Promise<Result> {
  try {
    const r = await removeSeriesMember(seriesId, await actor(slug), userId);
    if (r.ok) touch(slug);
    return r;
  } catch (err) {
    return fail(err);
  }
}

export type AddLotFormInput = {
  artist: { userId: string } | { name: string };
  proceeds: "artist" | "donated";
  title: string;
  descriptionHtml?: string | null;
  yearCreated?: number | null;
  medium?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  images: Array<{ url: string; nextcloudFileId?: string | null; nextcloudPath?: string | null }>;
  /** Major units. */
  estimateLow?: number | null;
  estimateHigh?: number | null;
  startingBid: number;
  reserve?: number | null;
  buyNow?: number | null;
  weekNo?: number | null;
  lotNumber?: number | null;
};

const minor = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null);

export async function addLotAction(seriesId: string, slug: string, input: AddLotFormInput): Promise<Result & { lotId?: string }> {
  try {
    const start = minor(input.startingBid);
    if (!start) return { ok: false, error: "Set a starting bid." };
    const r = await addSeriesLot({
      seriesId,
      actorUserId: await actor(slug),
      artist: input.artist,
      proceeds: input.proceeds,
      title: input.title,
      descriptionHtml: input.descriptionHtml ?? null,
      yearCreated: input.yearCreated ?? null,
      medium: input.medium ?? null,
      heightCm: input.heightCm ?? null,
      widthCm: input.widthCm ?? null,
      depthCm: input.depthCm ?? null,
      images: input.images,
      estimateLowMinor: minor(input.estimateLow),
      estimateHighMinor: minor(input.estimateHigh),
      startingBidMinor: start,
      reserveMinor: minor(input.reserve),
      buyNowMinor: minor(input.buyNow),
      weekNo: input.weekNo ?? null,
      lotNumber: input.lotNumber ?? null,
    });
    touch(slug);
    revalidatePath("/lots");
    return { ok: true, lotId: r.lotId };
  } catch (err) {
    return fail(err);
  }
}

// ─── Lots ────────────────────────────────────────────────────────────────────

export async function removeLotAction(seriesId: string, slug: string, lotId: string): Promise<Result> {
  try {
    await removeLotFromSeries(seriesId, await actor(slug), lotId);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function renumberLotsAction(seriesId: string, slug: string, orderedLotIds: string[]): Promise<Result> {
  try {
    await renumberSeriesLots(seriesId, await actor(slug), orderedLotIds);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function attachOpenLotAction(seriesId: string, slug: string, lotId: string): Promise<Result> {
  try {
    await addLotToSeries(seriesId, await actor(slug), lotId);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Weeks & content ─────────────────────────────────────────────────────────

export async function saveWeekAction(
  seriesId: string,
  slug: string,
  weekNo: number,
  input: { title?: string | null; focus?: string | null; brief?: string | null; color?: string | null; question?: string | null }
): Promise<Result> {
  try {
    await saveWeek(seriesId, await actor(slug), weekNo, input);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function addWeekItemAction(seriesId: string, slug: string, input: AddWeekItemInput): Promise<Result> {
  try {
    await addWeekItem(seriesId, await actor(slug), input);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removeWeekItemAction(seriesId: string, slug: string, slotId: string): Promise<Result> {
  try {
    await removeWeekItem(seriesId, await actor(slug), slotId);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function approveWeekItemAction(seriesId: string, slug: string, slotId: string): Promise<Result> {
  try {
    await approveWeekItem(seriesId, await actor(slug), slotId);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setWeekFeaturedAction(seriesId: string, slug: string, weekNo: number, artworkIds: string[]): Promise<Result> {
  try {
    await setWeekFeatured(seriesId, await actor(slug), weekNo, artworkIds);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function searchRepostableAction(seriesId: string, slug: string, q: string, mineOnly = false): Promise<WeekItemThread[]> {
  return searchRepostable(seriesId, await actor(slug), q, { mineOnly });
}

/** From the series page: a contributor or artist submits one of their own pieces. */
export async function submitOwnPieceAction(seriesId: string, slug: string, threadId: string, weekNo: number | null): Promise<Result> {
  try {
    const r = await submitOwnPiece(seriesId, await actor(slug), threadId, weekNo);
    if (r.ok) touch(slug);
    return r;
  } catch (err) {
    return fail(err);
  }
}

// ─── The desk's sources (migration 212) ──────────────────────────────────────

export async function collectiveArtistsAction(seriesId: string, slug: string): Promise<SeriesPerson[]> {
  return listCollectiveArtists(seriesId, await actor(slug));
}

export async function listLibrariesAction(seriesId: string, slug: string, artistUserId?: string | null): Promise<SeriesLibrary[]> {
  await actor(slug);
  return listSeriesLibraries(seriesId, artistUserId ?? null);
}

export async function listLibraryItemsAction(seriesId: string, slug: string, key: string): Promise<Array<{ url: string; name: string }>> {
  return listSeriesLibraryItems(seriesId, await actor(slug), key);
}

export async function listArtistListingsAction(seriesId: string, slug: string, artistUserId: string): Promise<ArtistListing[]> {
  return listArtistListings(seriesId, await actor(slug), artistUserId);
}

export async function addListingAction(
  seriesId: string,
  slug: string,
  input: { artworkId: string; startingBid: number; reserve?: number | null; buyNow?: number | null; lotNumber?: number | null; weekNo?: number | null }
): Promise<Result & { lotId?: string }> {
  try {
    const start = minor(input.startingBid);
    if (!start) return { ok: false, error: "Set a starting bid." };
    const r = await addListingToSeries({
      seriesId,
      actorUserId: await actor(slug),
      artworkId: input.artworkId,
      startingBidMinor: start,
      reserveMinor: minor(input.reserve),
      buyNowMinor: minor(input.buyNow),
      lotNumber: input.lotNumber ?? null,
      weekNo: input.weekNo ?? null,
    });
    touch(slug);
    revalidatePath("/lots");
    return { ok: true, lotId: r.lotId };
  } catch (err) {
    return fail(err);
  }
}

// ─── Participating organisations ─────────────────────────────────────────────

export async function searchOrgsAction(slug: string, q: string): Promise<Array<{ id: string; name: string; slug: string | null }>> {
  await actor(slug);
  return searchOrgs(q);
}

/**
 * Add an organisation. When the person adding it does not run that org, its
 * owners get a conversation (the marketplace inbox) and an email asking them
 * to accept, with a link to the invitations page.
 */
export async function addOrgAction(seriesId: string, slug: string, orgId: string, seriesTitle: string): Promise<Result & { status?: "accepted" | "invited"; notified?: number }> {
  try {
    const userId = await actor(slug);
    const r = await addSeriesOrg(seriesId, userId, orgId);
    if (r.status === "accepted") {
      touch(slug);
      return { ok: true, status: "accepted" };
    }
    const me = await getCurrentUser();
    const inviter = me?.displayName ?? me?.email ?? "A series editor";
    const link = `${siteConfig.url}/series/${slug}/invitations`;
    const ownerIds = r.owners.map((o) => o.userId).filter((id) => id !== userId);
    let notified = 0;
    if (ownerIds.length > 0) {
      const body =
        `${inviter} has asked your organisation to take part in the auction series "${seriesTitle}" on ${siteConfig.name}. ` +
        `Taking part lets the series desk show work from your organisation's media folder and list it among the series' partners. ` +
        `Accept or decline here: ${link}`;
      const { conversationId } = await startConversation({
        participantIds: [userId, ...ownerIds],
        subject: `Invitation: ${seriesTitle}`,
        context: { type: "series_org", id: `${seriesId}:${orgId}` },
        openingMessage: { senderId: userId, body },
      });
      await setSeriesOrgConversation(seriesId, orgId, conversationId);
      for (const o of r.owners) {
        if (!o.email || o.userId === userId) continue;
        if (await emailSeriesOrgInvitation({ to: o.email, orgId, seriesTitle, inviter, siteName: siteConfig.name, link })) notified++;
      }
    }
    touch(slug);
    return { ok: true, status: "invited", notified };
  } catch (err) {
    return fail(err);
  }
}

export async function removeOrgAction(seriesId: string, slug: string, orgId: string): Promise<Result> {
  try {
    await removeSeriesOrg(seriesId, await actor(slug), orgId);
    touch(slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
