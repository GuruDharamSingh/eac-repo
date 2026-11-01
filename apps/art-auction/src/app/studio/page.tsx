import Link from "next/link";
import {
  listStoreArtworks,
  listLotsForStore,
  listOrdersForStore,
  listPresentedArtworks,
  listArtworksForPerson,
  listBidsForUser,
} from "@elkdonis/commerce/queries";
import { getUnreadCount } from "@elkdonis/messaging/queries";
import { resolveStudioStore, getCurrentUser } from "@/lib/marketplace-auth";
import { CreditedElsewhere, MyBids } from "./_components/my-art-sections";
import { siteConfig } from "@/config/site";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingActions } from "./_components/listing-actions";
import { RemovePresentedButton } from "./_components/presented-actions";
import { selectStoreAction } from "./actions";

export const dynamic = "force-dynamic";

const statusTone: Record<string, BadgeProps["tone"]> = {
  draft: "neutral",
  available: "success",
  reserved: "pending",
  sold: "neutral",
  archived: "neutral",
};

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-serif text-2xl tracking-tight">
        {title}
        {count != null && <span className="ml-2 text-base text-muted-foreground">({count})</span>}
      </h2>
      {action}
    </div>
  );
}

export default async function StudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const sp = await searchParams;
  // A deep link from /studio/apply ("go to its studio"). Promote it into the
  // cookie the layout resolves from, then land on the clean URL — the layout
  // reads searchParams itself (Next only gives that to page.tsx), so this has
  // to happen before it renders, not after.
  if (sp.store) await selectStoreAction(sp.store);

  const resolved = await resolveStudioStore();
  const userId = resolved.userId!;
  const store = resolved.store?.status === "active" ? resolved.store : (resolved.stores.find((s) => s.status === "active") ?? null);
  const net = siteConfig.network;

  // Pieces credited to this person in stores other than the one shown, and
  // the lots they have bid on (migration 209; plan Phase F).
  const [creditedAll, myBids, user, unread] = await Promise.all([
    listArtworksForPerson(userId, { status: ["available", "reserved", "sold"] }),
    listBidsForUser(userId, 20),
    getCurrentUser(),
    getUnreadCount(userId),
  ]);
  // Includes pieces a series desk listed with this person as the maker in an
  // org's store (series workspace, 2026-10-28).
  const credited = creditedAll.filter(
    (a) => (a.creditedArtistUserId === userId || a.artistUserId === userId) && a.storeId !== store?.id
  );

  if (!store) {
    return (
      <>
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Credited pieces" value={credited.length} />
          <Stat label="Lots bid on" value={myBids.length} />
          <Stat label="New messages" value={unread} href="/messages" />
        </div>
        <section className="mb-12 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          You have no store yet. Open one to list your own work; pieces other stores credit to you
          and your bids are below.{" "}
          <Link href="/studio/apply" className="underline underline-offset-4">Open a store →</Link>
        </section>
        <CreditedElsewhere artworks={credited} />
        <MyBids bids={myBids} />
      </>
    );
  }

  const isOwn = store.ownerKind === "user";
  const canManageSales = isOwn || store.myRole === "owner" || store.myRole === "manager";

  const [artworks, lots, orders, presented] = await Promise.all([
    listStoreArtworks(store.id),
    listLotsForStore(store.id),
    listOrdersForStore(store.id, { limit: 50 }),
    listPresentedArtworks(store.id),
  ]);

  const openLotByArtwork = new Map(
    lots
      .filter((l) => l.status === "live" || l.status === "scheduled")
      .map((l) => [l.artwork?.id ?? "", l.id])
  );
  const listed = artworks.filter((a) => a.status === "available").length;
  const needsAction = orders.filter(
    (o) => o.status === "awaiting_etransfer" || o.status === "paid" || o.status === "payment_received"
  ).length;

  return (
    <>
      {/* Stats */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Works" value={artworks.length} />
        <Stat label="Listed" value={listed} />
        <Stat label="Sales needing you" value={needsAction} href="/studio/sales" />
        <Stat label="New messages" value={unread} href="/messages" />
      </div>

      {/* STORE */}
      <section className="mb-12">
        <SectionHeader
          title="Your listings"
          count={artworks.length}
          action={
            <div className="flex items-center gap-4 text-sm">
              {store.slug && (
                <Link href={`/artists/${store.slug}`} className="underline underline-offset-4">
                  View public page
                </Link>
              )}
              <Link href="/studio/artworks/new" className="underline underline-offset-4">
                Add a piece
              </Link>
            </div>
          }
        />

        {artworks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No artworks yet.{" "}
            <Link href="/studio/artworks/new" className="underline">
              Create the first piece
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {artworks.map((a) => (
              <li key={a.id} className="flex items-center gap-4 p-4">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  {a.primaryImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.primaryImageUrl}
                      alt={a.primaryImageAlt ?? a.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/artworks/${a.id}`}
                    className="truncate font-serif text-lg underline-offset-4 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                    {!isOwn && !a.artistUserId && (
                      <span className="text-muted-foreground">org-owned · no maker</span>
                    )}
                    <span className="text-muted-foreground">
                      {a.viewCount ?? 0} {a.viewCount === 1 ? "view" : "views"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ListingActions
                    artworkId={a.id}
                    status={a.status}
                    openLotId={openLotByArtwork.get(a.id) ?? null}
                  />
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/studio/artworks/${a.id}/edit`}>Edit</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PRESENTED — other stores' pieces shown in this front */}
      {(presented.length > 0 || !isOwn) && (
        <section className="mb-12">
          <SectionHeader title="Presented pieces" count={presented.length} />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            Work sold by other stores that this front shows. The artist still sells it
            and is still paid; a sale through this window is one your agreement with
            them applies to. Add pieces from their page on the marketplace.
          </p>
          {presented.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing presented yet. Open any listed piece and use “Show in {store.displayName ?? "this store"}”.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {presented.map((a) => (
                <li key={a.id} className="flex items-center gap-4 p-4">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    {a.primaryImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.primaryImageUrl} alt={a.primaryImageAlt ?? a.title} className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/artworks/${a.id}?via=${store.id}`} className="truncate font-serif text-lg underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.artistName ?? "—"} · {a.status}
                    </p>
                  </div>
                  {canManageSales && <RemovePresentedButton storeId={store.id} artworkId={a.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CreditedElsewhere artworks={credited} />
      <MyBids bids={myBids} />

      {/* NETWORK — the other two centralising sites */}
      <section className="mb-4">
        <SectionHeader title="Across the network" />
        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href={isOwn && user?.slug ? `${net.artdirectUrl}/${user.slug}` : net.artdirectUrl}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">ArtDirect profile</p>
            <p className="mt-1 text-muted-foreground">
              {isOwn && user?.slug
                ? "Your network-wide profile — bio, gallery, links. Your store name and photo come from it."
                : "The network-wide artist directory."}
            </p>
          </a>
          <a
            href={`${net.artsCollectiveUrl}/hub`}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">Arts Collective hub</p>
            <p className="mt-1 text-muted-foreground">
              Your organisations, workshops and community.
            </p>
          </a>
          <a
            href={`${net.artsCollectiveUrl}/hub/agreements`}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">Agreements</p>
            <p className="mt-1 text-muted-foreground">
              Which organisations take a share of your sales, and on what terms.
              No agreement, no cut.
            </p>
          </a>
        </div>
      </section>
    </>
  );
}
