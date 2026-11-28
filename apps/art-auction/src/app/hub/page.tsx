import type { ReactNode } from "react";
import Link from "next/link";
import { listOrders, listPendingStoreApplications, listSeries, listStores } from "@elkdonis/commerce/queries";
import { requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { artworksServer } from "@/lib/content-cards";
import { ChannelCardMount, ContentCardMount } from "@/components/hub/cards";
import { loadMarketChannel } from "@/lib/market-channel";
import { HubOpen } from "./_components/hub-surfaces";
import { applicationsFrame, membersFrame, moneyHubFrame, ordersFrame, seriesFrame, storesFrame } from "./_components/descriptors";

export const dynamic = "force-dynamic";

/**
 * /hub (MARKET_CENTER_AND_DOCK_2026-11-24, slice 5; round 6 board): the keepers' console, replacing /admin.
 * Bands as drawn. Orders and Stores open stacked popups (cms-ui surfaces); Artworks, Content library and Channel
 * are the content lane's hub cards (one popup each, "Open page" to /hub/content and /hub/channel). The rest open
 * /admin's pages until each has its popup. A non-admin keeper (an owner of the market org) sees what /admin gives
 * them today: stores, artworks, content.
 */

const PHASE: Record<string, string> = { announced: "Announced", silent: "Silent bidding", live: "Live close", closed: "Closed", draft: "Draft" };

function Face({
  kicker,
  colour,
  title,
  blurb,
  preview,
  children,
}: {
  kicker: string;
  colour: string;
  title: string;
  blurb?: string | null;
  preview?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, ${colour}, transparent 55%)` }} />
      {preview && <span className="mb-2 flex flex-col gap-1.5">{preview}</span>}
      <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <i aria-hidden className="block h-0.5 w-3 rounded" style={{ background: colour }} />
        {kicker}
      </span>
      <span className="font-serif text-xl leading-snug">{title}</span>
      {blurb && <span className="text-sm text-muted-foreground">{blurb}</span>}
      {children}
    </>
  );
}

const faceClass =
  "relative flex min-h-[190px] w-full flex-col justify-end gap-1.5 overflow-hidden rounded-lg border border-border bg-card p-5 pt-10 text-left shadow-sm transition-transform hover:-translate-y-0.5";

function LinkFace(props: { href: string; label: string } & Parameters<typeof Face>[0]) {
  const { href, label, ...face } = props;
  return (
    <Link href={href} aria-label={label} className={faceClass}>
      <span aria-hidden className="absolute right-4 top-4 font-mono text-muted-foreground">→</span>
      <Face {...face} />
    </Link>
  );
}

function OpenFace(props: { frame: Parameters<typeof HubOpen>[0]["frame"]; label: string } & Parameters<typeof Face>[0]) {
  const { frame, label, ...face } = props;
  return (
    <HubOpen frame={frame} label={label} className={faceClass}>
      <span aria-hidden className="absolute right-4 top-4 font-mono text-muted-foreground">+</span>
      <Face {...face} />
    </HubOpen>
  );
}

function Band({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "";

export default async function HubPage() {
  const { userId, isAdmin } = await requireKeeper();
  const viewer = await getHubCardViewer();

  const [orders, stores, applications, series, artworks, library, channel] = await Promise.all([
    isAdmin ? listOrders({ limit: 60 }).catch(() => []) : Promise.resolve([]),
    listStores({ limit: 120, status: ["active", "pending", "paused"] }).catch(() => []),
    isAdmin ? listPendingStoreApplications().catch(() => []) : Promise.resolve([]),
    isAdmin ? listSeries({ orgId: siteConfig.marketplaceOrgId }).catch(() => []) : Promise.resolve([]),
    viewer ? artworksServer.load(hubSite, viewer).catch(() => null) : Promise.resolve(null),
    // One Artworks card since round 2 (2026-11-26): the library is its "The collective" scope.
    Promise.resolve(null),
    loadMarketChannel({ userId }).catch(() => null),
  ]);

  const toShip = orders.filter((o) => o.status === "paid" || o.status === "payment_received");
  const toPay = orders.filter((o) => o.status === "pending_payment" || o.status === "awaiting_etransfer");
  const active = stores.filter((s) => s.status === "active");
  const newest = [...active].sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1)).slice(0, 2);
  const running = series.filter((s) => s.phase === "announced" || s.phase === "silent" || s.phase === "live");
  const drafts = series.filter((s) => s.phase === "draft");

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-24 pt-8">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hub · Collect Art</p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">The market this week</h1>
        <p className="text-sm text-muted-foreground">Each card opens over the hub; a popup opens as a page from its foot.</p>
      </div>

      <Band title="Needs you">
        {isAdmin && (
          <HubOpen frame={ordersFrame(toShip.length ? "ship" : "pay")} label="Orders" className={faceClass}>
            <span aria-hidden className="absolute right-4 top-4 font-mono text-muted-foreground">+</span>
            <Face
              kicker="Orders"
              colour="#a5521b"
              title={`${toShip.length} to ship, ${toPay.length} to pay`}
              blurb={`${orders.length} recent orders`}
              preview={toShip.slice(0, 2).map((o) => (
                <span key={o.id} className="flex items-center justify-between gap-3 text-sm">
                  <b className="font-medium">{o.number}</b>
                  <span className="truncate text-xs text-muted-foreground">{o.customerName?.trim() || o.customerEmail}</span>
                </span>
              ))}
            />
          </HubOpen>
        )}
        <HubOpen frame={storesFrame("active")} label="Stores" className={faceClass}>
          <span aria-hidden className="absolute right-4 top-4 font-mono text-muted-foreground">+</span>
          <Face
            kicker="Stores"
            colour="#2f4a63"
            title={`${active.length} active`}
            blurb={newest.length ? `Newest: ${newest.map((s) => `${s.displayName ?? "Store"} (${day(s.joinedAt)})`).join(", ")}` : null}
          />
        </HubOpen>
        {isAdmin && (
          <OpenFace
            frame={seriesFrame()}
            label="Series"
            kicker="Series"
            colour="#7a3e7a"
            title={running.length ? `${running.length} running` : "No series running"}
            blurb={[
              running[0] ? `${running[0].title}: ${PHASE[running[0].phase] ?? running[0].phase}` : null,
              drafts.length ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"}` : null,
            ].filter(Boolean).join(" · ") || null}
          />
        )}
        {isAdmin && applications.length > 0 && (
          <OpenFace frame={applicationsFrame()} label="Applications" kicker="Applications" colour="#8a6a00" title={`${applications.length} waiting`} blurb="Store applications to answer" />
        )}
      </Band>

      {(artworks || library || channel) && (
        <section aria-label="The market" className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80">The market</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {artworks && <ContentCardMount data={artworks} links={{ hubBase: "/hub" }} />}
            {channel && <ChannelCardMount data={channel} links={{ hubBase: "/hub" }} />}
          </div>
        </section>
      )}

      {isAdmin && (
        <Band title="Money and people">
          <OpenFace frame={moneyHubFrame()} label="Money" kicker="Money" colour="#1b6a45" title="Ledger, holds and payouts" blurb="Releasing held money stays with network admins" />
          <OpenFace frame={membersFrame()} label="Members" kicker="Members" colour="#4b5d4f" title="Members" blurb="Who is on the market, and their roles" />
          <LinkFace href="/admin/visitors" label="Visitors" kicker="Pulse" colour="#3b342f" title="Visitors" blurb="Who came, from where" />
        </Band>
      )}

      <section aria-label="Running things" className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Running things</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Link href="/admin/pages" className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Pages →</Link>}
          {isAdmin && <Link href="/admin/loft" className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Landing and loft →</Link>}
          <Link href="/admin/artworks" className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Artworks table →</Link>
          <Link href="/center" className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Your Center →</Link>
        </div>
      </section>
    </main>
  );
}
