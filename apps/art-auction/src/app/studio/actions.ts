"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import {
  applyForStore,
  updateStore,
  openOrgStore,
  createArtwork,
  updateArtwork,
  setArtworkMedia,
  publishArtwork,
  archiveArtwork,
  createLot,
  cancelLot,
  confirmOrderPaid,
  cancelOrder,
  markOrderFulfilled,
  refundOrder,
  canActForOrder,
  presentArtwork,
  unpresentArtwork,
  addStoreMember,
  removeStoreMember,
  setPayoutIdentity,
} from "@elkdonis/commerce/server";
import {
  disconnectStripeAccount,
  isCardPaymentAvailable,
  startStripeOnboarding,
} from "@elkdonis/checkout/stripe";
import type { ArtworkMediaInput, Currency, StoreMemberRole } from "@elkdonis/commerce/types";
import {
  getCurrentUser,
  getCurrentUserId,
  requireStudioStore,
  STUDIO_STORE_COOKIE,
} from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

// ─── Which store ─────────────────────────────────────────────────────────────

/** Switch the studio to another store the person can act for. */
export async function selectStoreAction(storeId: string): Promise<void> {
  const jar = await cookies();
  jar.set(STUDIO_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 86400,
  });
  redirect("/studio");
}

/**
 * Open a store for an organisation the person OWNS. Lands active — the org
 * owner is the same authority that would approve it — and the studio switches
 * to it.
 */
export async function openOrgStoreAction(orgId: string): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  try {
    const res = await openOrgStore({
      ownerOrgId: orgId,
      actorUserId: userId,
      orgId: siteConfig.marketplaceOrgId,
    });
    if (!res.ok || !res.store) return { ok: false, error: res.error ?? "Could not open the store." };
    const jar = await cookies();
    jar.set(STUDIO_STORE_COOKIE, res.store.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 180 * 86400,
    });
    revalidatePath("/studio");
    revalidatePath("/studio/apply");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Apply / profile ─────────────────────────────────────────────────────────

export type ArtistLinkInput = { label: string; url: string };

export type ApplyArtistInput = {
  displayName: string;
  headline?: string;
  city?: string;
  photoUrl?: string;
  bioHtml?: string;
  payoutEmail?: string;
  defaultCurrency?: Currency;
  links?: ArtistLinkInput[];
};

export async function applyArtistAction(input: ApplyArtistInput): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  if (!input.displayName?.trim())
    return { ok: false, error: "A display name is required." };
  if (!input.payoutEmail?.trim())
    return { ok: false, error: "An eTransfer payout email is required to apply. You can add card payouts through Stripe once approved." };

  try {
    // applyForStore refuses non-members — surface its reason rather than
    // reporting a generic failure, since "you aren't in the collective yet" is
    // something the applicant can act on.
    const result = await applyForStore({
      userId,
      orgId: siteConfig.marketplaceOrgId,
      displayName: input.displayName.trim(),
      headline: input.headline?.trim() || null,
      city: input.city?.trim() || null,
      photoUrl: input.photoUrl?.trim() || null,
      bioHtml: input.bioHtml ?? null,
      payoutEmail: input.payoutEmail.trim(),
      defaultCurrency: input.defaultCurrency,
      links: input.links,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/studio");
    revalidatePath("/studio/apply");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Edit the current store's profile. A person's store writes identity to
 * their `users` row (the same profile ArtDirect shows); an org store's
 * identity belongs to the organisation and is edited on the org hub, so only
 * the store-local fields (bio, links, currency) apply there.
 */
export async function updateProfileAction(input: ApplyArtistInput): Promise<Result> {
  const { userId, store } = await requireStudioStore();
  try {
    if (store.ownerKind === "user") {
      await updateStore(
        store.id,
        {
          displayName: input.displayName?.trim() || undefined,
          headline: input.headline?.trim() ?? null,
          city: input.city?.trim() ?? null,
          photoUrl: input.photoUrl?.trim() ?? null,
          bioHtml: input.bioHtml ?? null,
          defaultCurrency: input.defaultCurrency,
          links: input.links,
        },
        userId
      );
    } else {
      await updateStore(store.id, {
        bioHtml: input.bioHtml ?? null,
        defaultCurrency: input.defaultCurrency,
        links: input.links,
      });
    }
    revalidatePath("/studio/profile");
    revalidatePath("/studio");
    if (store.slug) revalidatePath(`/artists/${store.slug}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Artwork ─────────────────────────────────────────────────────────────────

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
  currency?: Currency;
  inventoryQty?: number;
  images: ArtworkMediaInput[];
  /**
   * Org stores only: credit the signed-in person as the maker (and payee).
   * Off means the organisation owns the piece outright — no maker, all
   * proceeds earmarked to the org.
   */
  creditMe?: boolean;
};

function toMinor(price: number): number {
  return Math.max(0, Math.round(Number(price) * 100));
}

export async function createArtworkAction(
  input: ArtworkFormInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { userId, store } = await requireStudioStore();
  if (!input.title?.trim()) return { ok: false, error: "A title is required." };

  // A person's store always credits them. An org store credits the person
  // only when they asked to be — otherwise the org is the maker of record.
  const makerUserId =
    store.ownerKind === "user" ? userId : input.creditMe ? userId : null;

  try {
    const { id } = await createArtwork({
      storeId: store.id,
      artistUserId: makerUserId,
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
      currency: input.currency,
      inventoryQty: input.inventoryQty ?? 1,
      images: input.images,
    });
    revalidatePath("/studio");
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

export async function updateArtworkAction(
  artworkId: string,
  input: ArtworkFormInput
): Promise<Result> {
  const { userId } = await requireStudioStore();
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
      currency: input.currency,
      inventoryQty: input.inventoryQty ?? undefined,
    });
    await setArtworkMedia(artworkId, userId, input.images);
    revalidatePath("/studio");
    revalidatePath(`/studio/artworks/${artworkId}/edit`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function publishArtworkAction(artworkId: string): Promise<Result> {
  const { userId } = await requireStudioStore();
  try {
    await publishArtwork(artworkId, userId);
    revalidatePath("/studio");
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveArtworkAction(artworkId: string): Promise<Result> {
  const { userId } = await requireStudioStore();
  try {
    await archiveArtwork(artworkId, userId);
    revalidatePath("/studio");
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Auctions ────────────────────────────────────────────────────────────────

export type CreateLotFormInput = {
  artworkId: string;
  /** ISO / datetime-local strings. */
  startAt?: string | null;
  endAt: string;
  /** Major units. */
  startingBid: number;
  reserve?: number | null;
  bidIncrement?: number | null;
  antiSnipeMinutes?: number | null;
};

export async function createLotAction(
  input: CreateLotFormInput
): Promise<{ ok: boolean; lotId?: string; error?: string }> {
  const { userId } = await requireStudioStore();
  try {
    const lot = await createLot({
      artworkId: input.artworkId,
      actorUserId: userId,
      startAt: input.startAt || null,
      endAt: input.endAt,
      startingBidMinor: toMinor(input.startingBid),
      reserveMinor: input.reserve != null && input.reserve > 0 ? toMinor(input.reserve) : null,
      bidIncrementMinor: input.bidIncrement != null && input.bidIncrement > 0 ? toMinor(input.bidIncrement) : undefined,
      antiSnipeMinutes: input.antiSnipeMinutes ?? undefined,
    });
    revalidatePath("/studio");
    revalidatePath("/lots");
    revalidatePath(`/artworks/${input.artworkId}`);
    return { ok: true, lotId: lot.id };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelLotAction(lotId: string): Promise<Result> {
  const { userId } = await requireStudioStore();
  try {
    await cancelLot({ lotId, actorUserId: userId });
    revalidatePath("/studio");
    revalidatePath("/lots");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Sales ───────────────────────────────────────────────────────────────────

async function requireOrderAccess(orderId: string): Promise<string> {
  const { userId } = await requireStudioStore();
  // Money actions need manager or above; staff can list and edit work only.
  if (!(await canActForOrder(userId, orderId, { minRole: "manager" }))) {
    throw new Error("Only a store owner or manager can settle this order.");
  }
  return userId;
}

/** The seller confirms an eTransfer arrived. */
export async function confirmOrderPaidAction(
  orderId: string,
  paymentReference?: string
): Promise<Result> {
  try {
    const userId = await requireOrderAccess(orderId);
    await confirmOrderPaid({
      orderId,
      confirmedByUserId: userId,
      method: "etransfer",
      paymentReference: paymentReference?.trim() || undefined,
    });
    revalidatePath("/studio");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelOrderAction(orderId: string, reason?: string): Promise<Result> {
  try {
    const userId = await requireOrderAccess(orderId);
    await cancelOrder({ orderId, actorUserId: userId, reason: reason?.trim() || "by seller" });
    revalidatePath("/studio");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function fulfilOrderAction(orderId: string, note?: string): Promise<Result> {
  try {
    const userId = await requireOrderAccess(orderId);
    await markOrderFulfilled({ orderId, actorUserId: userId, note: note?.trim() || undefined });
    revalidatePath("/studio");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * The seller records that they refunded an eTransfer sale. Card refunds are
 * issued by the collective from the platform account (admin), since a seller
 * cannot reverse a charge they did not take.
 */
export async function refundOrderAction(orderId: string, reason?: string): Promise<Result> {
  try {
    const userId = await requireOrderAccess(orderId);
    const rows = (await db`SELECT payment_method FROM commerce_order WHERE id = ${orderId}`) as unknown as Array<{ payment_method: string }>;
    if (rows[0]?.payment_method === "stripe") {
      return { ok: false, error: "Card orders are refunded by the collective — ask an admin." };
    }
    await refundOrder({ orderId, actorUserId: userId, reason: reason?.trim() || "by seller" });
    revalidatePath("/studio");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Presentation: what a front shows for other stores ──────────────────────

/** Show another store's listed piece in one of the caller's fronts. */
export async function presentArtworkAction(storeId: string, artworkId: string): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  try {
    await presentArtwork({ storeId, artworkId, actorUserId: userId });
    revalidatePath(`/artworks/${artworkId}`);
    revalidatePath("/studio");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function unpresentArtworkAction(storeId: string, artworkId: string): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  try {
    await unpresentArtwork({ storeId, artworkId, actorUserId: userId });
    revalidatePath(`/artworks/${artworkId}`);
    revalidatePath("/studio");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Payouts (the person's, never the store's) ──────────────────────────────

export async function setPayoutEmailAction(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio");
  const email = String(formData.get("payoutEmail") ?? "").trim();
  await setPayoutIdentity(userId, { payoutEmail: email || null });
  revalidatePath("/studio");
  redirect("/studio#payouts");
}

/** Send the person to Stripe Express onboarding (creates the account first). */
export async function startStripeOnboardingAction(): Promise<void> {
  if (!isCardPaymentAvailable()) throw new Error("Card payouts are not enabled on this site yet.");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/studio");
  const base = siteConfig.url.replace(/\/$/, "");
  const { url } = await startStripeOnboarding({
    userId: user.id,
    email: user.email ?? "",
    refreshUrl: `${base}/studio?stripe=refresh#payouts`,
    returnUrl: `${base}/studio?stripe=return#payouts`,
  });
  redirect(url);
}

export async function disconnectStripeAction(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio");
  await disconnectStripeAccount(userId);
  revalidatePath("/studio");
  redirect("/studio#payouts");
}

// ─── Team (org stores) ───────────────────────────────────────────────────────

export async function addStoreMemberAction(formData: FormData): Promise<void> {
  const { userId, store } = await requireStudioStore();
  if (store.ownerKind !== "org" || store.myRole !== "owner") {
    throw new Error("Only a store owner can add members.");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as StoreMemberRole;
  if (!["owner", "manager", "staff"].includes(role)) throw new Error("Unknown role.");
  const rows = (await db`
    SELECT id FROM users WHERE LOWER(email) = ${email} AND COALESCE(entity_type, 'person') = 'person' LIMIT 1
  `) as unknown as Array<{ id: string }>;
  if (!rows[0]) {
    redirect(`/studio?error=${encodeURIComponent("No account with that email. They need to sign up first.")}#team`);
  }
  await addStoreMember(store.id, rows[0].id, role, userId);
  revalidatePath("/studio");
  redirect("/studio#team");
}

export async function removeStoreMemberAction(memberUserId: string): Promise<void> {
  const { store } = await requireStudioStore();
  if (store.ownerKind !== "org" || store.myRole !== "owner") {
    throw new Error("Only a store owner can remove members.");
  }
  const res = await removeStoreMember(store.id, memberUserId);
  revalidatePath("/studio");
  redirect(res.ok ? "/studio#team" : `/studio?error=${encodeURIComponent(res.error ?? "Failed.")}#team`);
}
