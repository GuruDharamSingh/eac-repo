import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listStoreArtworks,
  listLotsForStore,
  listOrdersForStore,
  listOrdersForCustomer,
  listBidsForUser,
  listSeries,
  listSeriesForUser,
  listOrgsUserCanOpenStoreFor,
  type ActableStore,
} from "@elkdonis/commerce/queries";
import { getBalance, getPayoutIdentity, type Balance } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";
import { getUnreadCount, listConversationsForUser } from "@elkdonis/messaging/queries";
import { getCourseBySlug, getLearnerOutline, listMyEnrolments } from "@elkdonis/lms";
import { getCurrentUser, getIsKeeper, resolveStudioStore } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { chooseCenterStore } from "./actions";
import { ProfileFlip, RowList, TwoLists, type CenterRow } from "./_components/center-client";
import { OpenFrame } from "./_components/surfaces";
import { artworkFrame, auctionsFrame, entryFrame, installationsFrame, moneyFrame, pieceFrame, salesFrame, storeFrame } from "./_components/descriptors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Center" };

/**
 * /center: the person's place on the market (MARKET_CENTER_AND_DOCK_2026-11-24, round 5 layout, phase 1).
 * Cards read the same queries /studio uses and link to the /studio page that does the work; the popups
 * (store tabs, listing → write / post / series entry) are phase 2. "My work", the content library, is at
 * /center/work. A card with nothing to show is left out (css-ui rule: no empty-state rows on /center).
 */

const TZ = "America/Toronto";
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: TZ }) : null;
const at = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ })
    : null;

type Tone = "neutral" | "pending" | "success" | "destructive";
const PHASE: Record<string, { label: string; tone: Tone }> = {
  announced: { label: "Announced", tone: "pending" },
  silent: { label: "Silent bidding", tone: "success" },
  live: { label: "Live close", tone: "destructive" },
  closed: { label: "Closed", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
};

const ART_STATUS: Record<string, { label: string; tone: "neutral" | "pending" | "success" | "destructive" }> = {
  draft: { label: "Draft", tone: "neutral" },
  available: { label: "For sale", tone: "success" },
  reserved: { label: "Reserved", tone: "pending" },
  sold: { label: "Sold", tone: "neutral" },
  archived: { label: "Taken down", tone: "neutral" },
};

const ORDER_NEEDS_YOU = new Set(["awaiting_etransfer", "paid", "payment_received"]);

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "·"
  );
}

/** Spread a row of cards over 12 columns by weight, so a card left out does not leave a hole. */
function spans(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => Math.max(3, Math.round((w / total) * 12)));
  const diff = 12 - raw.reduce((a, b) => a + b, 0);
  if (raw.length) raw[raw.length - 1] = raw[raw.length - 1]! + diff;
  return raw;
}
const COL: Record<number, string> = {
  3: "md:col-span-3", 4: "md:col-span-4", 5: "md:col-span-5", 6: "md:col-span-6", 7: "md:col-span-7",
  8: "md:col-span-8", 9: "md:col-span-9", 12: "md:col-span-12",
};
function Row({ cards }: { cards: Array<{ key: string; weight: number; node: ReactNode } | null | false> }) {
  const shown = cards.filter(Boolean) as Array<{ key: string; weight: number; node: ReactNode }>;
  if (!shown.length) return null;
  const s = spans(shown.map((c) => c.weight));
  return (
    <>
      {shown.map((c, i) => (
        <div key={c.key} className={`min-w-0 ${COL[s[i]!] ?? "md:col-span-12"}`}>
          {c.node}
        </div>
      ))}
    </>
  );
}

function Card({
  label,
  aside,
  children,
  className = "",
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={`flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const pill = "inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted";
const quietLink = "text-sm underline-offset-4 hover:underline";

export default async function CenterPage() {
  const resolved = await resolveStudioStore();
  const userId = resolved.userId;
  if (!userId) redirect("/login?next=/center");
  const store: ActableStore | null =
    resolved.store?.status === "active" ? resolved.store : (resolved.stores.find((s) => s.status === "active") ?? null);
  const isOwn = store?.ownerKind === "user";
  const net = siteConfig.network;

  const [user, keeper, unread, conversations, bids, buyerOrders, seriesAll, mySeries, enrolments, openable] = await Promise.all([
    getCurrentUser(),
    getIsKeeper().catch(() => false),
    getUnreadCount(userId).catch(() => 0),
    listConversationsForUser(userId, { limit: 3 }).catch(() => []),
    listBidsForUser(userId, 10).catch(() => []),
    listOrdersForCustomer(userId, { limit: 10 }).catch(() => []),
    listSeries({ orgId: siteConfig.marketplaceOrgId, publishedOnly: true }).catch(() => []),
    listSeriesForUser(userId).catch(() => []),
    listMyEnrolments(userId).catch(() => []),
    listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId).catch(() => []),
  ]);

  const [artworks, lots, storeOrders] = store
    ? await Promise.all([
        listStoreArtworks(store.id).catch(() => []),
        listLotsForStore(store.id).catch(() => []),
        listOrdersForStore(store.id, { limit: 50 }).catch(() => []),
      ])
    : [[], [], []];

  let balance: Balance | null = null;
  let stripeReady = false;
  if (store && isOwn) {
    const [b, identity] = await Promise.all([
      getBalance({ kind: "user", userId }).catch(() => null),
      getPayoutIdentity(userId).catch(() => null),
    ]);
    balance = b;
    stripeReady = Boolean(identity?.stripeOnboardedAt);
  }

  // Trails: the person's courses with their progress (read only; the dock keeps the place).
  const trails: Array<{ slug: string; title: string; done: number; total: number }> = [];
  for (const e of enrolments.slice(0, 4)) {
    if (e.status === "withdrawn") continue;
    const course = await getCourseBySlug(e.courseSlug).catch(() => null);
    if (!course?.publishedVersionId) continue;
    const o = await getLearnerOutline({ userId, roles: {} }, { courseId: course.id }).catch(() => null);
    trails.push({ slug: e.courseSlug, title: e.courseTitle, done: o?.doneRequired ?? 0, total: o?.totalRequired ?? 0 });
    if (trails.length >= 2) break;
  }

  // ---- derived ----
  const name = store && !isOwn ? (user?.displayName ?? "You") : (store?.displayName ?? user?.displayName ?? "You");
  const first = (user?.displayName ?? name).split(/\s+/)[0] ?? "there";
  const openLotByArtwork = new Map(
    lots.filter((l) => l.status === "live" || l.status === "scheduled").map((l) => [l.artwork?.id ?? "", l]),
  );
  const toRow = (a: (typeof artworks)[number]): CenterRow => {
    const lot = openLotByArtwork.get(a.id);
    const st = lot ? { label: "In auction", tone: "destructive" as const } : (ART_STATUS[a.status] ?? { label: a.status, tone: "neutral" as const });
    const views = `${a.viewCount ?? 0} ${a.viewCount === 1 ? "view" : "views"}`;
    return {
      key: a.id,
      title: a.title,
      meta: lot ? `lot ${lot.lotNumber ?? ""} · ${views}`.replace("lot  ·", "lot ·") : views,
      href: `/studio/artworks/${a.id}/edit`,
      imageUrl: a.primaryImageUrl ?? null,
      badge: st,
      frame: a.status === "draft" ? artworkFrame(a.id) : pieceFrame(a.id, a.title),
    };
  };
  const current = artworks.filter((a) => a.status === "draft" || a.status === "available" || a.status === "reserved").map(toRow);
  const past = artworks.filter((a) => a.status === "sold" || a.status === "archived").map(toRow);
  const drafts = artworks.filter((a) => a.status === "draft");
  const salesNeedingYou = storeOrders.filter((o) => ORDER_NEEDS_YOU.has(o.status)).length;
  const listed = artworks.filter((a) => a.status === "available").length;

  const bidRows: CenterRow[] = bids.map((b) => ({
    key: b.lotId,
    title: b.title,
    meta: [b.seriesTitle, b.won ? "won" : b.lotStatus === "live" ? `closes ${day(b.endAt) ?? ""}` : b.lotStatus].filter(Boolean).join(" · "),
    href: `/lots/${b.lotId}`,
    imageUrl: b.imageUrl,
    badge: b.won
      ? { label: "Won", tone: "success" as Tone }
      : b.leading
        ? { label: "Winning", tone: "success" as Tone }
        : b.lotStatus === "live"
          ? { label: "Outbid", tone: "destructive" as Tone }
          : { label: "Ended", tone: "neutral" as Tone },
    amount: formatMoney(b.currentBidMinor, b.currency as never),
  }));
  const orderRows: CenterRow[] = buyerOrders.map((o) => ({
    key: o.id,
    title: `Order ${o.number}`,
    meta: `${day(o.createdAt) ?? ""} · ${o.status.replace(/_/g, " ")}`,
    href: `/orders/${o.id}`,
    badge: null,
    amount: formatMoney(o.totalMinor, o.currency),
  }));
  const outbid = bids.filter((b) => !b.leading && !b.won && b.lotStatus === "live").length;

  const ongoing = seriesAll.filter((s) => s.phase !== "closed" && s.phase !== "draft").slice(0, 4);
  const seriesRows: CenterRow[] = ongoing.map((s) => {
    const when =
      s.phase === "announced"
        ? s.silentOpensAt && `silent from ${day(s.silentOpensAt)}`
        : s.liveAt && `live close ${at(s.liveAt)}`;
    return {
      key: s.id,
      title: s.title,
      meta: ["Auction", s.presenterName ?? s.hostName, `${s.lotCount} lots`, when].filter(Boolean).join(" · "),
      href: `/series/${s.slug}`,
      imageUrl: s.card?.imageUrl ?? null,
      badge: PHASE[s.phase] ?? null,
    };
  });
  const deskSeries = mySeries.filter((s) => s.roles.some((r) => r === "editor" || r === "contributor" || r === "owner"));

  const todos = [
    salesNeedingYou > 0 && { label: "Sales needing you", n: salesNeedingYou, href: "/studio/sales", frame: salesFrame() },
    unread > 0 && { label: "Messages", n: unread, href: "/messages" },
    drafts.length > 0 && { label: "Drafts", n: drafts.length, href: "/studio" },
    outbid > 0 && { label: "Outbid", n: outbid, href: "/lots" },
  ].filter(Boolean) as Array<{ label: string; n: number; href: string; frame?: ReturnType<typeof salesFrame> }>;

  const profileLinks = [
    user?.slug && { label: "Directory page", note: "Your own space on the network", href: `${net.artdirectUrl}/${user.slug}` },
    { label: "Market profile", note: "Where you show, and how your cards read", href: "/center?open=profile" },
    { label: "Account", note: "Email, sign-in, addresses", href: "/account" },
    { label: "Agreements", note: "Who takes a share, on what terms", href: `${net.artsCollectiveUrl}/hub/agreements` },
  ].filter(Boolean) as Array<{ label: string; note: string; href: string }>;

  // ---- cards ----
  const profile = (
    <ProfileFlip
      name={name}
      line={store?.headline ?? null}
      place={store?.city ?? null}
      initials={initialsOf(name)}
      photoUrl={store?.photoUrl ?? null}
      role={store ? (isOwn ? "Store active" : `${store.displayName ?? "Store"} · ${store.myRole}`) : "No store"}
      links={profileLinks}
    />
  );

  const storeCard = store && (
    <section aria-label="Your store" className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <OpenFrame frame={storeFrame("front")} aria-label="Open your store" className="relative block h-32 w-full shrink-0 bg-muted text-left">
        {store.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.photoUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-3 left-4 rounded-full bg-card/95 px-2 py-0.5 text-xs font-medium">
          {isOwn ? "Your store" : `Acting for · ${store.myRole}`}
        </span>
      </OpenFrame>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">
            <OpenFrame frame={storeFrame("front")} className="text-left hover:underline">{store.displayName ?? "Your store"}</OpenFrame>
          </h2>
        </div>
        {store.headline && <p className="text-sm text-muted-foreground">{store.headline}</p>}
        <div className="flex flex-wrap gap-6">
          <span><b className="text-xl tabular-nums">{listed}</b> <span className="text-xs text-muted-foreground">listed</span></span>
          <span><b className="text-xl tabular-nums">{salesNeedingYou}</b> <span className="text-xs text-muted-foreground">sales needing you</span></span>
          <span><b className="text-xl tabular-nums">{artworks.length}</b> <span className="text-xs text-muted-foreground">works</span></span>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2">
          <OpenFrame frame={storeFrame("front")} className={pill}>Store front</OpenFrame>
          <OpenFrame frame={storeFrame("shipping")} className={pill}>Shipping</OpenFrame>
          <OpenFrame frame={salesFrame()} className={pill}>Sales</OpenFrame>
          <OpenFrame frame={auctionsFrame()} className={pill}>Auctions</OpenFrame>
          <OpenFrame frame={installationsFrame()} className={pill}>Installations</OpenFrame>
          {store.slug && (
            <Link href={`/artists/${store.slug}`} className={`${pill} ml-auto`}>Preview ↗</Link>
          )}
        </div>
      </div>
    </section>
  );

  const publishCard = store && (
    <Card label="Publish" className="min-h-[420px]">
      <OpenFrame
        frame={artworkFrame()}
        data-eac-anchor="artwork"
        className="flex min-h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-border bg-muted/30 p-3 text-center hover:border-primary"
      >
        <span aria-hidden className="text-2xl text-primary">⇪</span>
        <b className="font-semibold">Add pictures to start an artwork</b>
        <span className="text-sm text-muted-foreground">Add a work: pictures, details and price, in one place</span>
      </OpenFrame>
      <div className="grid grid-cols-2 gap-2">
        <OpenFrame frame={artworkFrame()} className={`${pill} justify-center`}>Artwork</OpenFrame>
        <OpenFrame frame={entryFrame()} className={`${pill} justify-center`}>Series entry</OpenFrame>
      </div>
      {drafts.length > 0 && (
        <div>
          <p className="py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Drafts</p>
          <RowList rows={drafts.slice(0, 2).map(toRow)} empty="" />
        </div>
      )}
    </Card>
  );

  const collectingCard =
    (bidRows.length > 0 || orderRows.length > 0) && (
      <Card label="Collecting" aside={<Link href="/account" className={quietLink}>Account</Link>} className={store ? "" : "min-h-[420px]"}>
        <TwoLists
          label="Collecting"
          a={{ title: "Bids", rows: bidRows.slice(0, 4), empty: "No bids yet." }}
          b={{ title: "Orders", rows: orderRows.slice(0, 4), empty: "No orders yet." }}
        />
      </Card>
    );

  const openStoreCard = !store && (
    <section aria-label="Sell here" className="flex h-full min-h-[420px] flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Sell here</p>
      <h2 className="font-serif text-3xl leading-tight">Open a store</h2>
      <p className="text-sm opacity-90">
        A store opens at once. Three steps finish it, in the dock: a description, where you ship from, your first artwork.
      </p>
      <p className="text-xs opacity-80">The collective keeps 5% of each sale. Your directory page stays your own.</p>
      <div className="flex-1" />
      <Link href="/studio/apply" className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-4 font-medium text-primary-foreground">
        Open a store
      </Link>
      {openable.filter((o) => !o.storeId).length > 0 && (
        <p className="text-xs opacity-80">You can also open one for an organisation you own, from the store page.</p>
      )}
    </section>
  );

  const listingsCard =
    store && artworks.length > 0 ? (
      <Card label="Listings" aside={<Link href="/center/work" className={quietLink}>All my work →</Link>}>
        <TwoLists
          label="Listings"
          a={{ title: "Current", rows: current.slice(0, 6), empty: "Nothing listed right now." }}
          b={{ title: "Past", rows: past.slice(0, 6), empty: "Nothing sold or taken down yet." }}
        />
      </Card>
    ) : null;

  const nextCard =
    trails.length > 0 ? (
      <Card label="Next">
        <ul className="flex flex-col gap-3">
          {trails.map((t) => {
            const done = t.total > 0 && t.done >= t.total;
            return (
              <li key={t.slug} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-primary text-primary-foreground" : "border-2 border-primary text-primary"
                  }`}
                >
                  {done ? "✓" : t.done + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {done ? "Done" : `${t.done} of ${t.total} done`}
                  </span>
                </span>
                {!done && (
                  <a href={`${net.artsCollectiveUrl}/learn/${encodeURIComponent(t.slug)}`} className={quietLink}>
                    Continue
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    ) : null;

  const seriesCard =
    seriesRows.length > 0 ? (
      <Card
        label="Ongoing series"
        aside={
          <span className="flex items-center gap-4">
            {store && <OpenFrame frame={entryFrame()} className={quietLink}>Enter a piece</OpenFrame>}
            <Link href="/lots" className={quietLink}>All auctions →</Link>
          </span>
        }
      >
        <RowList rows={seriesRows} empty="" />
      </Card>
    ) : null;

  const messagesCard =
    conversations.length > 0 ? (
      <Card
        label="Messages"
        aside={unread > 0 ? <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{unread}</span> : undefined}
      >
        <ul className="flex flex-col">
          {conversations.map((c) => (
            <li key={c.id} className="border-t border-border first:border-t-0">
              <Link href={`/messages/${c.id}`} className="flex min-h-11 flex-col justify-center py-2 hover:underline">
                <span className={c.unreadCount > 0 ? "font-semibold" : "font-medium"}>
                  {c.others.map((o) => o.displayName ?? "Someone").join(", ") || c.subject || "Conversation"}
                </span>
                {c.lastMessagePreview && <span className="truncate text-sm text-muted-foreground">{c.lastMessagePreview}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/messages" className={quietLink}>All messages</Link>
      </Card>
    ) : null;

  const moneyCard = store ? (
    <Card label="Money" aside={<OpenFrame frame={moneyFrame()} className={quietLink}>Details</OpenFrame>}>
      {isOwn ? (
        <>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(balance?.payableMinor ?? 0, (balance?.currency ?? "CAD") as never)}</p>
          <p className="text-sm text-muted-foreground">
            ready to pay out
            {balance && balance.heldMinor > 0 ? ` · ${formatMoney(balance.heldMinor, balance.currency as never)} held` : ""}
            {" · "}
            {stripeReady ? "Stripe connected" : "payouts not set up"}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">The store’s earnings and team, on its money page.</p>
      )}
    </Card>
  ) : null;

  const deskCard =
    deskSeries.length > 0 ? (
      <Card label="Series you help run">
        <ul className="flex flex-col">
          {deskSeries.slice(0, 3).map((s) => (
            <li key={s.id} className="border-t border-border first:border-t-0">
              <Link href={`/series/${s.slug}/manage`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline">
                <span className="font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground">{PHASE[s.phase]?.label ?? s.phase}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    ) : null;

  const directoryCard =
    !store && !user?.slug ? (
      <Card label="Your directory page">
        <p className="text-sm">Your own space on the network, apart from any store or organisation. It comes with a cloud folder.</p>
        <a href={net.artdirectUrl} className={`${pill} w-fit`}>Take your space</a>
      </Card>
    ) : null;

  const others = resolved.stores.filter((s) => s.id !== store?.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Center</p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">Good to see you, {first}.</h1>
      </div>

      {/* The strip: who you act for, the network, and what needs you */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {store && (
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="font-normal text-muted-foreground">Acting for</span> {store.displayName ?? "Your store"} ▾
              </summary>
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 flex min-w-72 flex-col rounded-xl border border-border bg-card p-1.5 shadow-lg">
                <span className="rounded-lg px-3 py-2.5 text-sm">
                  <b className="font-medium">{store.displayName ?? "Your store"}</b>
                  <span className="block text-xs text-muted-foreground">{isOwn ? "Your store · owner" : `Organisation store · ${store.myRole}`}</span>
                </span>
                {others.map((s) => (
                  <form key={s.id} action={chooseCenterStore.bind(null, s.id)}>
                    <button type="submit" className="flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                      <b className="font-medium">{s.displayName ?? "Store"}</b>
                      <span className="text-xs text-muted-foreground">
                        {s.ownerKind === "org" ? `Organisation store · ${s.myRole}` : "Your store"}
                        {s.status !== "active" ? ` · ${s.status}` : ""}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </details>
          )}
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Network ▾
            </summary>
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 flex min-w-72 flex-col rounded-xl border border-border bg-card p-1.5 shadow-lg">
              <a href={user?.slug ? `${net.artdirectUrl}/${user.slug}` : net.artdirectUrl} className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <b className="font-medium">Your directory page</b>
                <span className="text-xs text-muted-foreground">Your own space, apart from any store</span>
              </a>
              <Link href="/center/work" className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <b className="font-medium">My work</b>
                <span className="text-xs text-muted-foreground">Your pieces and files, in the content library</span>
              </Link>
              <a href={`${net.artsCollectiveUrl}/channel`} className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <b className="font-medium">Your channel</b>
                <span className="text-xs text-muted-foreground">Posts, queue and outlets, on arts-collective.com</span>
              </a>
              <a href={`${net.artsCollectiveUrl}/learn`} className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <b className="font-medium">Learn</b>
                <span className="text-xs text-muted-foreground">Trails and courses</span>
              </a>
              {keeper && (
                <Link href="/hub" className="flex min-h-11 flex-col justify-center rounded-lg border-t border-border px-3 py-2 text-sm hover:bg-muted">
                  <b className="font-medium">Run the market</b>
                  <span className="text-xs text-muted-foreground">Orders, stores, series, site</span>
                </Link>
              )}
            </div>
          </details>
        </div>
        {todos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {todos.map((t) => {
              const chip = "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pl-4 pr-1.5 text-sm font-medium hover:bg-muted";
              const inner = (
                <>
                  {t.label}
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-foreground px-2 text-xs font-semibold text-background">
                    {t.n}
                  </span>
                </>
              );
              return t.frame ? (
                <OpenFrame key={t.label} frame={t.frame} className={chip}>{inner}</OpenFrame>
              ) : (
                <Link key={t.label} href={t.href} className={chip}>{inner}</Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
        {store ? (
          <>
            <Row cards={[
              { key: "profile", weight: 3, node: profile },
              { key: "store", weight: 5, node: storeCard },
              { key: "publish", weight: 4, node: publishCard },
            ]} />
            <Row cards={[
              listingsCard && { key: "listings", weight: 8, node: listingsCard },
              nextCard && { key: "next", weight: 4, node: nextCard },
            ]} />
            <Row cards={[
              seriesCard && { key: "series", weight: 6, node: seriesCard },
              messagesCard && { key: "messages", weight: 3, node: messagesCard },
              moneyCard && { key: "money", weight: 3, node: moneyCard },
            ]} />
            <Row cards={[
              collectingCard && { key: "collecting", weight: 6, node: collectingCard },
              deskCard && { key: "desk", weight: 6, node: deskCard },
            ]} />
          </>
        ) : (
          <>
            <Row cards={[
              { key: "profile", weight: 3, node: profile },
              collectingCard && { key: "collecting", weight: 5, node: collectingCard },
              { key: "open", weight: 4, node: openStoreCard },
            ]} />
            <Row cards={[
              seriesCard && { key: "series", weight: 8, node: seriesCard },
              nextCard && { key: "next", weight: 4, node: nextCard },
            ]} />
            <Row cards={[
              messagesCard && { key: "messages", weight: 4, node: messagesCard },
              deskCard && { key: "desk", weight: 4, node: deskCard },
              directoryCard && { key: "directory", weight: 4, node: directoryCard },
            ]} />
          </>
        )}
      </div>
    </main>
  );
}
