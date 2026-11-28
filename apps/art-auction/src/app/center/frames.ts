"use server";

/**
 * The /center popups' server side (MARKET_CENTER_AND_DOCK_2026-11-24, slice 4 phase 2).
 *
 * Each `load*` reads what one popup draws, for the person in the session; nothing is taken from the client but
 * ids, and every id is checked through the same queries /studio uses (getArtworkForEdit only returns a piece
 * the person's store sells). The forms inside the popups save through /studio's own actions. The one new write
 * is `enterSeriesAction`, the first caller of commerce's `enterSeries`.
 */

import { revalidatePath } from "next/cache";
import {
  getArtworkForEdit,
  getSellerProfile,
  listLotsForStore,
  listOrdersForStore,
  listStoreArtworks,
} from "@elkdonis/commerce/queries";
import {
  updateStoreProfile,
  enterSeries,
  getBalance,
  getEarningsStatement,
  getPayoutIdentity,
  listEnterableSeries,
  type Balance,
  type EarningsLine,
} from "@elkdonis/commerce/server";
import {
  getArtworkParcel,
  getShipFrom,
  getShipFromDefaults,
  getStoreShippingMode,
  listOrderShipments,
  orderShippingOf,
} from "@elkdonis/commerce/shipping";
import { formatMoney } from "@elkdonis/commerce/money";
import { getCurrentUserId, resolveStudioStore } from "@/lib/marketplace-auth";
import { toNetworkProfile } from "@/lib/profile-bio";
import { siteConfig } from "@/config/site";
import { listingContext } from "@/app/studio/listing-context";
import { artworkFormInitial } from "@/app/studio/artwork-initial";
import { contentHost } from "@/lib/content-host";
import {
  createInstallation,
  getInstallation,
  listHangableArtworks,
  listInstallationArtworks,
  listInstallationPieces,
  listInstallationsForStores,
} from "@/lib/installations";
import { INSTALLATION_VENUES, isVenueId } from "@/lib/installation-venues";
import { getStoreByHandle, listArtworksForPerson, listSeriesForUser, listStoreFrontArtworks, listStoresForUser } from "@elkdonis/commerce/queries";
import { searchContent } from "@elkdonis/content/server";
import { sanitizeRichText } from "@elkdonis/utils";
import { profileBioHtml } from "@/lib/profile-bio";
import { getCurrentUser } from "@/lib/marketplace-auth";

type Fail = { ok: false; error: string };
const NO_STORE: Fail = { ok: false, error: "Open a store first." };

/** The store /center is acting for: the chosen one when active, else any active one. */
async function actingStore() {
  const r = await resolveStudioStore();
  if (!r.userId) return { userId: null, store: null } as const;
  const store = r.store?.status === "active" ? r.store : (r.stores.find((s) => s.status === "active") ?? null);
  return { userId: r.userId, store } as const;
}

// ── Store ───────────────────────────────────────────────────────────────────

export async function loadStoreFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const isOwn = store.ownerKind === "user";
  const [shipFrom, shippingMode, me] = await Promise.all([
    getShipFrom(userId).catch(() => null),
    getStoreShippingMode(store.id).catch(() => "arranged" as const),
    isOwn && store.ownerUserId ? getSellerProfile(store.ownerUserId).catch(() => null) : Promise.resolve(null),
  ]);
  const shipFromDefaults = shipFrom ? null : await getShipFromDefaults(userId).catch(() => null);
  return {
    ok: true as const,
    name: store.displayName ?? "Your store",
    slug: store.slug ?? null,
    isOwn,
    canEdit: isOwn || store.myRole === "owner" || store.myRole === "manager",
    own: store.own ?? { displayName: null, headline: null, city: null, photoUrl: null },
    fallback: store.fallback ?? { displayName: null, headline: null, city: null, photoUrl: null },
    coverUrl: store.coverUrl ?? null,
    accent: typeof store.theme?.accent === "string" ? (store.theme.accent as string) : null,
    bioHtml: store.bioHtml ?? "",
    storeKind: store.ownerKind,
    profile: isOwn ? toNetworkProfile(me, siteConfig.network.artdirectUrl) : undefined,
    initial: { bioHtml: store.bioHtml, payoutEmail: store.payoutEmail, links: store.links },
    shipFrom: shipFrom ?? null,
    shipFromDefaults: shipFromDefaults ?? null,
    shippingMode,
  };
}

// ── Artwork (add or edit) ───────────────────────────────────────────────────

export async function loadArtworkFrame(artworkId?: string | null) {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const [ctx, fileSources] = await Promise.all([
    listingContext(store),
    // The seller's folders for the picture picker (content CONTRACT 10.8): key and label only; the folders
    // route resolves each root on the server.
    (contentHost.fileSources?.({ userId }) ?? Promise.resolve([])).catch(() => []),
  ]);
  const base = {
    ok: true as const,
    sources: fileSources.map((x) => ({ key: x.key, label: x.label })),
    storeName: store.displayName ?? "your store",
    allowMakerChoice: store.ownerKind === "org",
    beneficiaries: ctx.beneficiaries,
    orgOptions: ctx.orgOptions,
  };
  if (!artworkId) return { ...base, initial: null, parcel: null };
  const artwork = await getArtworkForEdit(artworkId, userId);
  if (!artwork) return { ok: false as const, error: "That piece is not one of your store’s." };
  const parcel = await getArtworkParcel(artwork.id).catch(() => null);
  return { ...base, initial: artworkFormInitial(artwork), parcel };
}

// ── One piece (the listing frame) ───────────────────────────────────────────

export async function loadPieceFrame(artworkId: string) {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  const artwork = await getArtworkForEdit(String(artworkId), userId);
  if (!artwork) return { ok: false as const, error: "That piece is not one of your store’s." };
  const lots = store ? await listLotsForStore(store.id).catch(() => []) : [];
  const lot = lots.find((l) => l.artwork?.id === artwork.id && (l.status === "live" || l.status === "scheduled")) ?? null;
  const v = artwork.variants?.[0];
  const image = (artwork.media ?? []).find((m) => m.id === artwork.primaryImageId) ?? artwork.media?.[0] ?? null;
  return {
    ok: true as const,
    id: artwork.id,
    title: artwork.title,
    status: artwork.status as "draft" | "available" | "reserved" | "sold" | "archived",
    imageUrl: image?.url ?? null,
    medium: artwork.medium ?? null,
    size: [artwork.heightCm, artwork.widthCm].every((n) => n != null) ? `${artwork.heightCm} × ${artwork.widthCm} cm` : null,
    price: v && v.priceMinor > 0 ? formatMoney(v.priceMinor, v.currency) : "Price on request",
    views: artwork.viewCount ?? 0,
    lot: lot
      ? {
          id: lot.id,
          status: lot.status,
          currentBid: lot.currentBidMinor != null ? formatMoney(lot.currentBidMinor, lot.currency as never) : null,
          endAt: lot.endAt ?? null,
        }
      : null,
    publicHref: `/artworks/${artwork.id}`,
  };
}

// ── Series entry ────────────────────────────────────────────────────────────

export async function loadEntryFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const [series, artworks, lots] = await Promise.all([
    listEnterableSeries(userId, siteConfig.marketplaceOrgId).catch(() => []),
    listStoreArtworks(store.id).catch(() => []),
    listLotsForStore(store.id).catch(() => []),
  ]);
  const inAuction = new Set(lots.filter((l) => l.status === "live" || l.status === "scheduled").map((l) => l.artwork?.id ?? ""));
  return {
    ok: true as const,
    series: series.map((s) => ({ id: s.id, slug: s.slug, title: s.title, silentOpensAt: s.silentOpensAt, liveAt: s.liveAt })),
    pieces: artworks
      .filter((a) => a.status === "available" && !inAuction.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, imageUrl: a.primaryImageUrl ?? null })),
  };
}

/**
 * Enter one of the person's published pieces into an auction series (commerce `enterSeries`: it re-checks
 * that the series is open to this person and that the piece is published in a store they act for, then makes
 * the lot on the series' clock). Amounts arrive in dollars and are stored in cents.
 */
export async function enterSeriesAction(input: {
  seriesId: string;
  artworkId: string;
  startingBid: number;
  reserve?: number | null;
}): Promise<{ ok: true; lotNumber: number; seriesSlug: string | null } | Fail> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  const start = Number(input?.startingBid);
  if (!Number.isFinite(start) || start < 1) return { ok: false, error: "The starting bid must be at least 1." };
  const reserve = input?.reserve == null || input.reserve === ("" as never) ? null : Number(input.reserve);
  if (reserve != null && (!Number.isFinite(reserve) || reserve < start)) {
    return { ok: false, error: "A reserve must be a number no lower than the starting bid." };
  }
  try {
    const r = await enterSeries({
      seriesId: String(input.seriesId),
      actorUserId: userId,
      artworkId: String(input.artworkId),
      startingBidMinor: Math.round(start * 100),
      reserveMinor: reserve != null ? Math.round(reserve * 100) : null,
    });
    const slug = (await listEnterableSeries(userId, siteConfig.marketplaceOrgId).catch(() => [])).find((s) => s.id === input.seriesId)?.slug ?? null;
    revalidatePath("/center");
    return { ok: true, lotNumber: r.lotNumber, seriesSlug: slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The piece could not be entered." };
  }
}

// ── Money ───────────────────────────────────────────────────────────────────

export async function loadMoneyFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const isOwn = store.ownerKind === "user";
  const party = isOwn ? ({ kind: "user", userId } as const) : ({ kind: "org", orgId: store.ownerOrgId! } as const);
  let balance: Balance | null = null;
  let lines: EarningsLine[] = [];
  try {
    [balance, lines] = await Promise.all([getBalance(party), getEarningsStatement(party, { limit: 8 })]);
  } catch {
    balance = null;
    lines = [];
  }
  const identity = isOwn ? await getPayoutIdentity(userId).catch(() => null) : null;
  const cur = (balance?.currency ?? "CAD") as never;
  return {
    ok: true as const,
    isOwn,
    payable: formatMoney(balance?.payableMinor ?? 0, cur),
    held: formatMoney(balance?.heldMinor ?? 0, cur),
    total: formatMoney(balance?.totalMinor ?? 0, cur),
    stripeReady: Boolean(identity?.stripeOnboardedAt),
    lines: lines.map((l) => ({
      id: l.entryId,
      when: l.createdAt,
      what: l.description ?? (l.orderNumber ? `Order ${l.orderNumber}` : l.payoutMethod ? `Paid out · ${l.payoutMethod}` : l.entryType.replace(/_/g, " ")),
      amount: formatMoney(l.amountMinor, l.currency as never),
      held: l.held,
    })),
  };
}

// ── Sales (the store's orders) ──────────────────────────────────────────────

export async function loadSalesFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const isOwn = store.ownerKind === "user";
  const orders = await listOrdersForStore(store.id, { limit: 50 }).catch(() => []);
  const [mode, shipments] = await Promise.all([
    getStoreShippingMode(store.id).catch(() => "arranged" as const),
    listOrderShipments(orders.map((o) => o.id)).catch(() => ({}) as Awaited<ReturnType<typeof listOrderShipments>>),
  ]);
  return {
    ok: true as const,
    canManage: isOwn || store.myRole === "owner" || store.myRole === "manager",
    orders: orders.map((o) => {
      const sh = orderShippingOf(o.metadata);
      return {
        order: { id: o.id, status: o.status, paymentMethod: o.paymentMethod, number: o.number },
        when: o.createdAt,
        who: o.customerName?.trim() || o.customerEmail,
        total: formatMoney(o.totalMinor, o.currency),
        auction: o.metadata?.kind === "auction",
        shipping: sh ? { mode: (sh.mode ?? mode) as "quote" | "platform" | "arranged", serviceName: sh.option?.name ?? null } : null,
        shipment: shipments[o.id] ?? null,
      };
    }),
  };
}

// ── Auctions (the store's lots) ─────────────────────────────────────────────

export async function loadAuctionsFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const lots = await listLotsForStore(store.id).catch(() => []);
  return {
    ok: true as const,
    lots: lots.map((l) => ({
      id: l.id,
      title: l.artwork?.title ?? "Untitled lot",
      status: l.status,
      at: l.status === "scheduled" ? l.startAt : l.endAt,
      bids: l.bidCount,
      price: formatMoney(l.currentBidMinor ?? l.startingBidMinor, l.currency),
      reserve: l.reserveMinor != null ? formatMoney(l.reserveMinor, l.currency) : null,
      orderId: typeof l.metadata?.orderId === "string" ? (l.metadata.orderId as string) : null,
    })),
  };
}

// ── Market profile: where the person shows (the old /studio/presence) ────────

export async function loadPresenceFrame() {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  const [user, stores, pieces, series] = await Promise.all([
    getCurrentUser(),
    listStoresForUser(userId).catch(() => []),
    listArtworksForPerson(userId, { status: ["available", "reserved", "sold"] }).catch(() => []),
    listSeriesForUser(userId).catch(() => []),
  ]);
  const byStore = new Map<string, number>();
  for (const a of pieces) byStore.set(a.storeId, (byStore.get(a.storeId) ?? 0) + 1);
  const net = siteConfig.network;
  return {
    ok: true as const,
    places: [
      { title: "ArtDirect page", href: user?.slug ? `${net.artdirectUrl}/${user.slug}` : net.artdirectUrl, note: "Your network profile: bio, galleries, services, your store and work credited to you." },
      ...stores.map((s) => ({
        title: s.ownerUserId === userId ? `${s.displayName ?? "Your store"} (your store)` : `${s.displayName ?? "Organisation store"} (you are ${s.myRole})`,
        href: s.slug ? `/artists/${s.slug}` : "/artists",
        note: `${byStore.get(s.id) ?? 0} of your pieces here · ${s.status}`,
      })),
      ...series.map((s) => ({ title: s.title, href: `/series/${s.slug}`, note: `Auction series · ${s.roles.map((r) => (r === "artist" ? "your work" : r)).join(", ")} · ${s.phase}` })),
    ],
    cards: pieces
      .filter((a) => a.status === "available")
      .slice(0, 6)
      .map((a) => ({ id: a.id, title: a.title, imageUrl: a.primaryImageUrl ?? null })),
  };
}

// ── Installations ───────────────────────────────────────────────────────────

export async function loadInstallationsFrame() {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false as const, error: "Sign in first." };
  if (!store) return NO_STORE;
  const list = await listInstallationsForStores([store.id]).catch(() => []);
  return {
    ok: true as const,
    venues: INSTALLATION_VENUES.map((v) => ({ id: v.id, name: v.name, blurb: v.blurb })),
    installations: list.map((i) => ({ id: i.id, title: i.title, pieces: i.pieceCount, updatedAt: i.updatedAt, published: i.status === "published" })),
  };
}

export async function loadInstallationFrame(id: string) {
  const r = await resolveStudioStore();
  if (!r.userId) return { ok: false as const, error: "Sign in first." };
  const installation = await getInstallation(String(id));
  if (!installation?.storeId || !r.stores.some((s) => s.id === installation.storeId)) {
    return { ok: false as const, error: "That installation is not one of yours." };
  }
  const [hangable, hung, pieces] = await Promise.all([
    listHangableArtworks(installation.storeId),
    listInstallationArtworks(installation.id, { publicOnly: false }),
    listInstallationPieces(installation.id),
  ]);
  const known = new Map(hangable.map((a) => [a.id, a]));
  for (const a of hung) if (!known.has(a.id)) known.set(a.id, a);
  return { ok: true as const, installation, artworks: [...known.values()], pieces };
}

/** Start a collection from the /center popup: the same insert as /studio's form, returning the id instead of redirecting. */
export async function createInstallationFrame(input: { title: string; venue: string }): Promise<{ ok: true; id: string } | Fail> {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false, error: "Sign in first." };
  if (!store) return NO_STORE;
  const title = String(input?.title ?? "").trim().slice(0, 140) || "Untitled collection";
  try {
    const id = await createInstallation(store.id, title, userId, isVenueId(input?.venue) ? input.venue : "northwest");
    revalidatePath("/studio/installations");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The collection could not be started." };
  }
}

// ── The store's own profile and look ────────────────────────────────────────

/**
 * Save the store's own name, line, city, photo, cover, note and colour. Writes the store only (commerce
 * `updateStoreProfile`); the owner's network profile is untouched and shows through any field left empty.
 * The person must run the store: its owner, or an owner or manager of an organisation's store.
 */
export async function saveStoreProfileAction(input: {
  displayName?: string;
  headline?: string;
  city?: string;
  photoUrl?: string;
  coverUrl?: string;
  bioHtml?: string;
  accent?: string | null;
  links?: Array<{ label: string; url: string }>;
  timeline?: Array<{ year: string; text: string }>;
  files?: Array<{ name: string; url: string; size?: number | null }>;
}): Promise<{ ok: true } | Fail> {
  const { userId, store } = await actingStore();
  if (!userId) return { ok: false, error: "Sign in first." };
  if (!store) return NO_STORE;
  if (!(store.ownerKind === "user" || store.myRole === "owner" || store.myRole === "manager")) {
    return { ok: false, error: "Only the store’s owners and managers can change it." };
  }
  try {
    await updateStoreProfile(store.id, {
      displayName: input.displayName,
      headline: input.headline,
      city: input.city,
      photoUrl: input.photoUrl,
      coverUrl: input.coverUrl,
      bioHtml: input.bioHtml,
      theme: input.accent === undefined ? undefined : { accent: input.accent },
      links: input.links === undefined ? undefined : input.links.filter((l) => /^https?:\/\//.test(String(l?.url ?? "").trim())).slice(0, 20).map((l) => ({ label: String(l.label ?? "").trim().slice(0, 80), url: String(l.url).trim().slice(0, 500) })) as never,
      timeline: input.timeline,
      files: input.files,
    });
    revalidatePath("/center");
    if (store.slug) revalidatePath(`/artists/${store.slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The store could not be saved." };
  }
}

// ── An artist's profile on the market (public) ──────────────────────────────

/**
 * The artist profile popup: the store's own profile (network profile as fallback), its colour and cover, a few
 * works and pieces of writing. Public data only, for anyone; `canEdit` is true when the visitor is acting for
 * this store, so the popup can offer its own edit tabs.
 */
export async function loadArtistFrame(handle: string) {
  const store = await getStoreByHandle(String(handle)).catch(() => null);
  if (!store || store.status !== "active") return { ok: false as const, error: "This artist has no store on the market." };
  const [artworks, writing, acting] = await Promise.all([
    listStoreFrontArtworks(store.id, { limit: 12 }).catch(() => []),
    store.ownerKind === "user" && store.ownerUserId
      ? searchContent(null, { scope: { kind: "person", userId: store.ownerUserId }, types: ["writing"], limit: 3 }, contentHost)
          .then((r) => r.items)
          .catch(() => [])
      : Promise.resolve([]),
    actingStore().catch(() => ({ userId: null, store: null })),
  ]);
  const net = siteConfig.network;
  const slug = store.slug ?? store.id;
  return {
    ok: true as const,
    slug,
    canEdit: acting.store?.id === store.id,
    name: store.displayName ?? "Artist",
    headline: store.headline ?? null,
    city: store.city ?? null,
    photoUrl: store.photoUrl ?? null,
    coverUrl: store.coverUrl ?? null,
    accent: typeof store.theme?.accent === "string" ? (store.theme.accent as string) : null,
    bioHtml: store.bioHtml ? sanitizeRichText(store.bioHtml) : store.ownerKind === "user" ? profileBioHtml(store.profileBio) || null : null,
    links: store.links.map((l) => ({ label: l.label || null, url: l.url })),
    networkHref: store.ownerKind === "user" && store.slug && !/^[0-9a-f-]{36}$/i.test(store.slug) ? `${net.artdirectUrl}/${store.slug}` : null,
    works: artworks.map((a) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.primaryImageUrl ?? null,
      detail: [a.medium, a.heightCm && a.widthCm ? `${a.heightCm} × ${a.widthCm} cm` : null, a.yearCreated].filter(Boolean).join(" · "),
      status: a.status,
    })),
    timeline: (store.profile?.timeline ?? []).filter((t) => t && t.text),
    files: (store.profile?.files ?? []).filter((f) => f && f.url),
    rawLinks: store.links.map((l) => ({ label: l.label ?? "", url: l.url })),
    writing: writing.map((w) => ({ key: w.key, title: w.title, href: w.links?.public ?? null, excerpt: w.excerpt ?? null })),
  };
}
