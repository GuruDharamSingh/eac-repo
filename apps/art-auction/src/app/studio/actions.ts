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
import { canEtransfer, normaliseCountry } from "@elkdonis/commerce/payout-rails";
import type { ArtworkMediaInput, Currency, StoreMemberRole } from "@elkdonis/commerce/types";
import {
  getCurrentUser,
  getCurrentUserId,
  requireStudioStore,
  signInPath,
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
    revalidatePath("/studio", "layout");
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
  /** The store's own note (store.bio_html). */
  bioHtml?: string;
  /**
   * Plain-text network bio (users.bio). The profile fields above and this one
   * are sent only when the person opened "Edit profile"; undefined leaves the
   * profile untouched.
   */
  profileBio?: string;
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
      profileBio: input.profileBio ?? null,
      payoutEmail: input.payoutEmail.trim(),
      defaultCurrency: input.defaultCurrency,
      links: input.links,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/studio", "layout");
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
          // Undefined means "not edited here": leave the profile as it is.
          displayName: input.displayName?.trim() || undefined,
          headline: input.headline === undefined ? undefined : input.headline.trim() || null,
          city: input.city === undefined ? undefined : input.city.trim() || null,
          photoUrl: input.photoUrl === undefined ? undefined : input.photoUrl.trim() || null,
          profileBio: input.profileBio,
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
    revalidatePath("/studio", "layout");
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
  /**
   * Credit an artist without paying them (migration 209): the store keeps
   * the proceeds. Used for donated work in an org store.
   */
  creditedArtistUserId?: string | null;
  /** Auction estimate, major units. */
  estimateLow?: number | null;
  estimateHigh?: number | null;
  /** "Donated by X to Y". Blank means no donation recorded. */
  donation?: {
    fromUserId?: string | null;
    fromText?: string | null;
    toOrgId?: string | null;
    occurredOn?: string | null;
    note?: string | null;
  } | null;
  /** Where this listing's money goes, from the org's beneficiary list. */
  beneficiaryPayeeId?: string | null;
  beneficiaryScope?: "all_proceeds" | "commission" | null;
};

function provenanceFrom(input: ArtworkFormInput) {
  const d = input.donation;
  if (!d || (!d.fromUserId && !d.fromText?.trim() && !d.toOrgId)) return [];
  return [
    {
      kind: "donated" as const,
      fromUserId: d.fromUserId ?? null,
      fromText: d.fromText?.trim() || null,
      toOrgId: d.toOrgId ?? null,
      occurredOn: d.occurredOn || null,
      note: d.note?.trim() || null,
    },
  ];
}

function toMinorOrNull(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

/**
 * People a lister may credit: a name or email search across the network,
 * org members first. Used by the artwork form's credit picker.
 */
export async function searchPeopleAction(
  q: string
): Promise<Array<{ id: string; name: string; email: string | null; slug: string | null }>> {
  const { store } = await requireStudioStore();
  const term = q.trim();
  if (term.length < 2) return [];
  const like = "%" + term + "%";
  const rows = (await db`
    SELECT u.id, COALESCE(u.display_name, u.email) AS name, u.email, u.slug,
      (uo.user_id IS NOT NULL) AS in_org
    FROM users u
    LEFT JOIN user_organizations uo
      ON uo.user_id = u.id AND uo.org_id = ${store.ownerOrgId ?? ""} AND uo.role <> 'viewer'
    WHERE COALESCE(u.entity_type, 'person') = 'person'
      AND (u.display_name ILIKE ${like} OR u.email ILIKE ${like})
    ORDER BY in_org DESC, u.display_name ASC NULLS LAST
    LIMIT 8
  `) as unknown as Array<{ id: string; name: string; email: string | null; slug: string | null }>;
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, slug: r.slug }));
}

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
      actorUserId: userId,
      artistUserId: makerUserId,
      creditedArtistUserId: input.creditedArtistUserId ?? null,
      estimateLowMinor: toMinorOrNull(input.estimateLow),
      estimateHighMinor: toMinorOrNull(input.estimateHigh),
      provenance: provenanceFrom(input),
      beneficiaryPayeeId: input.beneficiaryPayeeId ?? null,
      beneficiaryScope: input.beneficiaryScope ?? null,
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
    revalidatePath("/studio", "layout");
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
      creditedArtistUserId: input.creditedArtistUserId ?? null,
      estimateLowMinor: toMinorOrNull(input.estimateLow),
      estimateHighMinor: toMinorOrNull(input.estimateHigh),
      provenance: provenanceFrom(input),
      beneficiaryPayeeId: input.beneficiaryPayeeId ?? null,
      beneficiaryScope: input.beneficiaryScope ?? null,
    });
    await setArtworkMedia(artworkId, userId, input.images);
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveArtworkAction(artworkId: string): Promise<Result> {
  const { userId } = await requireStudioStore();
  try {
    await archiveArtwork(artworkId, userId);
    revalidatePath("/studio", "layout");
    revalidatePath("/");
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
  /**
   * Which auction this lot belongs to: a short name kept in the lot's metadata
   * (`auction_lot.metadata.event`). The page blocks filter on it, so one site
   * can run a silent auction page for one event and another for the next.
   * Empty means no tag.
   */
  event?: string | null;
  /** Major units. Shown until the first bid. */
  buyNow?: number | null;
  /** `ladder` copies the marketplace ladder onto the lot; `flat` uses `bidIncrement`. */
  incrementMode?: "ladder" | "flat";
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
      buyNowMinor: input.buyNow != null && input.buyNow > 0 ? toMinor(input.buyNow) : null,
      incrementMode: input.incrementMode ?? "ladder",
    });
    // createLot has already checked this person may act for the store; the tag
    // is only a label on the row it made.
    const event = (input.event ?? "").trim();
    if (event && /^[\w -]{1,60}$/.test(event)) {
      await db`
        UPDATE auction_lot SET metadata = metadata || ${db.json({ event } as never)}
        WHERE id = ${lot.id}
      `;
    }
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function fulfilOrderAction(orderId: string, note?: string): Promise<Result> {
  try {
    const userId = await requireOrderAccess(orderId);
    await markOrderFulfilled({ orderId, actorUserId: userId, note: note?.trim() || undefined });
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/");
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
    revalidatePath("/studio", "layout");
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
    revalidatePath("/studio", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Payouts (the person's, never the store's) ──────────────────────────────

export async function setPayoutEmailAction(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(await signInPath());
  const email = String(formData.get("payoutEmail") ?? "").trim();
  await setPayoutIdentity(userId, { payoutEmail: email || null });
  revalidatePath("/studio", "layout");
  redirect("/studio/payouts");
}

/**
 * Save the whole payout setup at once: where they are, and the rail that can
 * reach them there.
 *
 * Re-checks the country against the rail server-side. The form only offers
 * what works, but a rail is the difference between being paid and not, so it
 * is not a decision to take on the client's word.
 */
export async function savePayoutSetupAction(input: {
  country: string;
  rail: "etransfer" | "stripe" | "manual";
  payoutEmail: string | null;
}): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(await signInPath());

  const country = normaliseCountry(input.country);
  if (input.rail === "etransfer") {
    if (!canEtransfer(country)) {
      throw new Error("An Interac e-Transfer can only reach a Canadian bank account.");
    }
    if (!input.payoutEmail) throw new Error("We need the email to send the e-Transfer to.");
  }

  await setPayoutIdentity(userId, {
    country,
    payoutMethod: input.rail,
    payoutEmail: input.rail === "etransfer" ? input.payoutEmail : null,
  });
  revalidatePath("/studio", "layout");
}

/** Send the person to Stripe Express onboarding (creates the account first). */
export async function startStripeOnboardingAction(): Promise<void> {
  if (!isCardPaymentAvailable()) throw new Error("Card payouts are not enabled on this site yet.");
  const user = await getCurrentUser();
  if (!user) redirect(await signInPath());
  const base = siteConfig.url.replace(/\/$/, "");
  const { url } = await startStripeOnboarding({
    userId: user.id,
    email: user.email ?? "",
    refreshUrl: `${base}/studio/payouts?stripe=refresh`,
    returnUrl: `${base}/studio/payouts?stripe=return`,
  });
  redirect(url);
}

export async function disconnectStripeAction(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(await signInPath());
  await disconnectStripeAccount(userId);
  revalidatePath("/studio", "layout");
  redirect("/studio/payouts");
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
    redirect(`/studio/payouts?error=${encodeURIComponent("No account with that email. They need to sign up first.")}`);
  }
  await addStoreMember(store.id, rows[0].id, role, userId);
  revalidatePath("/studio", "layout");
  redirect("/studio/payouts");
}

export async function removeStoreMemberAction(memberUserId: string): Promise<void> {
  const { store } = await requireStudioStore();
  if (store.ownerKind !== "org" || store.myRole !== "owner") {
    throw new Error("Only a store owner can remove members.");
  }
  const res = await removeStoreMember(store.id, memberUserId);
  revalidatePath("/studio", "layout");
  redirect(res.ok ? "/studio/payouts" : `/studio/payouts?error=${encodeURIComponent(res.error ?? "Failed.")}`);
}
