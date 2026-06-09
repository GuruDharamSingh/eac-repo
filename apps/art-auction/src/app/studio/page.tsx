import Link from "next/link";
import type { Metadata } from "next";
import { listMyArtworks, listLotsForArtist } from "@elkdonis/commerce/queries";
import {
  listConversationsForUser,
  getUnreadCount,
} from "@elkdonis/messaging/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { requireApprovedArtist, getCurrentUser } from "@/lib/marketplace-auth";
import { LogoutButton } from "@/components/logout-button";
import { ListingActions } from "./_components/listing-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-emerald-100 text-emerald-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-stone-200 text-stone-700",
  archived: "bg-stone-100 text-stone-500",
};

const lotStatusStyles: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  live: "bg-emerald-100 text-emerald-800",
  ended: "bg-stone-200 text-stone-700",
  sold: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-100 text-stone-500",
  passed: "bg-stone-100 text-stone-500",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  id,
}: {
  title: string;
  count?: number;
  id: string;
}) {
  return (
    <h2 id={id} className="scroll-mt-24 font-serif text-2xl tracking-tight">
      {title}
      {count != null && (
        <span className="ml-2 text-base text-muted-foreground">({count})</span>
      )}
    </h2>
  );
}

export default async function StudioPage() {
  const { artist } = await requireApprovedArtist();
  const [user, artworks, lots, conversations, unread] = await Promise.all([
    getCurrentUser(),
    listMyArtworks(artist.userId),
    listLotsForArtist(artist.userId),
    listConversationsForUser(artist.userId, { limit: 6 }),
    getUnreadCount(artist.userId),
  ]);

  const listed = artworks.filter((a) => a.status === "available").length;
  const totalViews = artworks.reduce((sum, a) => sum + (a.viewCount ?? 0), 0);
  const activeLots = lots.filter(
    (l) => l.status === "live" || l.status === "scheduled"
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Studio</h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back, {artist.displayName ?? user?.displayName ?? "artist"}.
            {user?.email && <span className="opacity-60"> · {user.email}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/studio/profile"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Edit profile
          </Link>
          <Link
            href="/studio/artworks/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New artwork
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Works" value={artworks.length} />
        <Stat label="Listed" value={listed} />
        <Stat label="Total views" value={totalViews} />
        <Stat label="New messages" value={unread} />
      </div>

      {/* In-page nav */}
      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
        <a href="#store" className="text-muted-foreground hover:text-foreground">
          Store
        </a>
        <a href="#auctions" className="text-muted-foreground hover:text-foreground">
          Active auctions
        </a>
        <a href="#messages" className="text-muted-foreground hover:text-foreground">
          Messages
        </a>
        <a href="#connect" className="text-muted-foreground hover:text-foreground">
          Connect &amp; curate
        </a>
      </nav>

      {/* STORE */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeader title="Your store" count={artworks.length} id="store" />
          <Link
            href="/studio/artworks/new"
            className="text-sm underline underline-offset-4"
          >
            Add a piece
          </Link>
        </div>

        {artworks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            You haven&rsquo;t added any artworks yet.{" "}
            <Link href="/studio/artworks/new" className="underline">
              Create your first piece
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
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-medium ${
                        statusStyles[a.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                    <span className="text-muted-foreground">
                      {a.viewCount ?? 0} {a.viewCount === 1 ? "view" : "views"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ListingActions artworkId={a.id} status={a.status} />
                  <Link
                    href={`/studio/artworks/${a.id}/edit`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ACTIVE AUCTIONS */}
      <section className="mb-12">
        <SectionHeader
          title="Active auctions"
          count={activeLots.length}
          id="auctions"
        />
        <div className="mt-4">
          {activeLots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              You have no live or scheduled auctions. (Auction listing tools are
              coming next — the marketplace buy-now flow is the current focus.)
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {activeLots.map((lot) => (
                <li
                  key={lot.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/lots/${lot.id}`}
                      className="truncate font-serif text-lg underline-offset-4 hover:underline"
                    >
                      {lot.artwork?.title ?? "Untitled lot"}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ends {new Date(lot.endAt).toLocaleString("en-CA")} ·{" "}
                      {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm tabular-nums">
                      {formatMoney(
                        lot.currentBidMinor ?? lot.startingBidMinor,
                        lot.currency
                      )}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        lotStatusStyles[lot.status] ??
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lot.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* MESSAGES — unified through @elkdonis/messaging (same threads as /messages) */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeader
            title="Messages"
            count={conversations.length}
            id="messages"
          />
          <Link href="/messages" className="text-sm underline underline-offset-4">
            View all messages
          </Link>
        </div>
        <div>
          {conversations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No messages yet. When a collector asks about one of your pieces,
              the conversation shows up here and in your inbox.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {conversations.map((c) => {
                const who =
                  c.others
                    .map((o) => o.displayName?.trim() || o.email || "Someone")
                    .join(", ") || "Conversation";
                return (
                  <li key={c.id}>
                    <Link
                      href={`/messages/${c.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{who}</span>
                          {c.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                              {c.unreadCount}
                            </span>
                          )}
                        </p>
                        {c.subject && (
                          <p className="truncate text-xs text-muted-foreground">
                            Re: {c.subject}
                          </p>
                        )}
                        {c.lastMessagePreview && (
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {c.lastMessageSenderId === artist.userId
                              ? "You: "
                              : ""}
                            {c.lastMessagePreview}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(c.lastMessageAt).toLocaleDateString("en-CA")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* CONNECT & CURATE (placeholder) */}
      <section className="mb-4">
        <SectionHeader title="Connect &amp; curate" id="connect" />
        <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Coming soon</p>
          <p className="mt-1">
            Share and cross-promote your work, link your social profiles, and
            curate collections with other artists in the network. We&rsquo;re
            building this next.
          </p>
        </div>
      </section>
    </main>
  );
}
