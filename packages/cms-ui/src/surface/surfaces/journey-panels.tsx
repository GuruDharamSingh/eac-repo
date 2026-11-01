"use client";

import * as React from "react";
import {
  useSurfaceOptional,
  type SurfaceAuctionJourney,
  type SurfaceOwnService,
  type SurfaceOrgPerson,
  type SurfacePresence,
  type SurfacePresenceCell,
  type SurfaceProfile,
  type SurfaceProfileInput,
  type SurfaceProfileLink,
} from "../index";
import { PAYOUT_COUNTRIES } from "./ProfileSurface";
import { ConnectionsPanel } from "../ConnectionsPanel";
import { serializeDescriptor, urlWithSurface } from "../url";
import type { SurfaceMeTab } from "../types";

// ============================================================================
// The journey panels: the bodies of the journey dialogs (Center take three,
// 2026-10-18). Each has the same anatomy — a dark rail on the left saying
// where you stand and what the errand is, the steps and their controls on
// the right, in place:
//
//   SellingPanel   publish work → open your store → set up your payout
//   OrgPanel       (owners and guides) details first, then people
//   ProfilePanel   the ArtDirect journey: details, where you show, links
//   SitePanel      start an organisation of your own on a subdomain
//
// The forms write through the same connectors the profile popup used
// (`connectors.profile`, `.presence`, `.journey`, `.orgPeople`), so a host that
// wired the popup has wired these. Plain CSS (center.css, the `eac-jt-*` rules).
// ============================================================================

export type CenterJourney = SurfaceAuctionJourney;
export type StepState = "done" | "next" | "todo";

// ── shared pieces ────────────────────────────────────────────────────────────

function Rail({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <aside className="eac-jt-rail">
      <div className="eac-jt-rail-head">
        <span className="eac-jt-rail-kicker">{kicker}</span>
        <span className="eac-jt-rail-title">{title}</span>
      </div>
      {children}
    </aside>
  );
}

export function states(done: boolean[]): StepState[] {
  const first = done.indexOf(false);
  return done.map((d, i) => (d ? "done" : i === first ? "next" : "todo"));
}
function RailSteps({ steps }: { steps: Array<{ label: string; note?: string | null; done: boolean }> }) {
  const st = states(steps.map((s) => s.done));
  return (
    <ol className="eac-jt-steps">
      {steps.map((s, i) => (
        <li key={s.label} data-state={st[i]}>
          <span className="eac-jt-n" aria-hidden>
            {s.done ? "✓" : i + 1}
          </span>
          <span className="eac-jt-step-text">
            <span>{s.label}</span>
            {s.note && <em>{s.note}</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Notice({ text, tone }: { text: string | null; tone: "normal" | "error" }) {
  return text ? (
    <p className="eac-jt-notice" data-tone={tone} role={tone === "error" ? "alert" : undefined}>
      {text}
    </p>
  ) : null;
}

function SubTabs<T extends string>({ items, value, onChange }: { items: Array<{ id: T; label: string; badge?: number }>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="eac-jt-subtabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className="eac-jt-subtab" onClick={() => onChange(it.id)}>
          {it.label}
          {it.badge ? <span className="eac-jt-badge">{it.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── Selling art ──────────────────────────────────────────────────────────────

export function SellingPanel() {
  const surfaces = useSurfaceOptional();
  const api = surfaces?.connectors.journey;
  const payoutApi = surfaces?.connectors.profile?.page;
  const canAddHere = Boolean(surfaces?.connectors.artwork);
  const [j, setJ] = React.useState<SurfaceAuctionJourney | null>(null);
  const [busy, setBusy] = React.useState<"store" | "payouts" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [country, setCountry] = React.useState("");

  const reload = React.useCallback(() => {
    api?.load("auction").then(setJ).catch(() => {});
  }, [api]);
  React.useEffect(() => {
    reload();
  }, [reload]);
  // The journey changes while the page is open (a piece published in the
  // artwork surface, a store opened): re-read whenever the surface stack
  // mutates something.
  React.useEffect(() => {
    if (!api) return;
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [api, reload]);

  const commission = j?.store.commissionPercent ?? 5;
  const store = j?.store.state === "active" && j.store.handle ? (api?.links.store(j.store.handle) ?? null) : null;
  const needsCountry = Boolean(j?.payouts.available && j.payouts.state === "none" && !j.payouts.country && payoutApi?.startPayouts);
  const done = [Boolean(j && j.artworks.published > 0), j?.store.state === "active", j?.payouts.state === "ready"];
  const st = states(done);

  async function openStore() {
    if (!api) return;
    setBusy("store");
    setNotice(null);
    const r = await api.publishStore().catch(() => ({ ok: false as const, error: "Could not reach the marketplace." }));
    setBusy(null);
    if (r.ok === false) return setNotice(r.error);
    reload();
    surfaces?.connectors.onMutated?.();
  }
  async function connect() {
    if (!payoutApi?.startPayouts) return;
    setBusy("payouts");
    setNotice(null);
    const r = await payoutApi.startPayouts(needsCountry ? country : undefined).catch(() => ({ ok: false as const, error: "Could not reach Stripe." }));
    setBusy(null);
    if (r.ok === false) return setNotice(r.error || "Could not reach Stripe.");
    window.location.assign(r.url);
  }
  function addWork(e: React.MouseEvent<HTMLElement>) {
    if (canAddHere) surfaces!.open({ type: "artwork" }, e.currentTarget);
    else if (api?.links.addWork) window.location.assign(api.links.addWork);
  }

  return (
    <div className="eac-jt-body">
      <Rail kicker="Art Auction · November" title="Sell your art on the market">
        <RailSteps
          steps={[
            { label: "Publish a work", note: j ? (j.artworks.published > 0 ? `${j.artworks.published} published` : "nothing published yet") : null, done: done[0] },
            { label: "Open your store", note: j ? (j.store.state === "active" ? "listed on the auction site" : j.store.state === "none" ? "no store yet" : j.store.state) : null, done: done[1] },
            { label: "Set up your payout", note: j ? (j.payouts.state === "ready" ? "Stripe connected" : j.payouts.state === "pending" ? "Stripe started" : "Stripe not connected") : null, done: done[2] },
          ]}
        />
        <div className="eac-jt-rail-foot">
          Fees: Stripe 2.9% + 30¢ · collective {commission}%
          <details className="eac-jt-fees">
            <summary>How the money moves</summary>
            <p>Stripe takes its card fee and pays the rest to your account. The collective keeps {commission}% of each sale for future events and the running of the platform. On a $1,000 sale: Stripe $29.30, collective ${(commission * 10).toFixed(2)}, you receive ${(1000 - 29.3 - commission * 10).toFixed(2)}. Buyers pay the hammer price; there is no buyer premium.</p>
          </details>
          {api?.links.about && <a href={api.links.about}>About the auction →</a>}
        </div>
      </Rail>

      <div className="eac-jt-main">
        {j && (
          <div className="eac-jt-tiles">
            <div><span>Published</span><strong>{j.artworks.published}</strong></div>
            <div><span>Sold</span><strong>{j.artworks.sold}</strong></div>
            <div><span>Drafts</span><strong>{j.artworks.drafts}</strong></div>
          </div>
        )}

        <section className="eac-jt-step" data-state={st[0]}>
          <span className="eac-jt-step-tag">Step 1 · {LABEL[st[0]]}</span>
          <h3>Publish a work</h3>
          <p>A photo, title, medium, size and a price. Several in one sitting; each is kept as a draft until you publish.</p>
          <div className="eac-jt-controls">
            <button type="button" className="eac-jt-btn eac-jt-btn--primary" onClick={addWork} disabled={!canAddHere && !api?.links.addWork}>
              {j && j.artworks.published > 0 ? "Add another work" : "Add a work"}
            </button>
            {store && j && j.artworks.published > 0 && (
              <a className="eac-jt-link" href={store} target="_blank" rel="noopener">
                See your {j.artworks.published} {j.artworks.published === 1 ? "work" : "works"} →
              </a>
            )}
          </div>
        </section>

        <section className="eac-jt-step" data-state={st[1]}>
          <span className="eac-jt-step-tag">Step 2 · {LABEL[st[1]]}</span>
          <h3>{j?.store.state === "active" ? "Your store is on the auction site" : "Open your store on the auction site"}</h3>
          {j?.store.state === "active" ? (
            <p>Everything you publish appears in the catalogue under your name.</p>
          ) : j && j.store.state === "none" && !j.canClaimStore ? (
            <p>
              A store is for members of the collective, and you follow rather than belong to an organisation so far. Ask the
              organisers of the site you came from to make you a member, or start an organisation of your own: as its owner you
              can open a store at once.
            </p>
          ) : j && (j.store.state === "paused" || j.store.state === "rejected") ? (
            <p>Your store is {j.store.state}. The marketplace team decides that; ask them before publishing again.</p>
          ) : (
            <p>One click opens a store under your name on the marketplace and lists your published work. The collective keeps {commission}% of each sale.</p>
          )}
          <div className="eac-jt-controls">
            {j && j.store.state !== "active" && j.canClaimStore && (j.store.state === "none" || j.store.state === "pending") && api && (
              <button type="button" className="eac-jt-btn eac-jt-btn--primary" disabled={busy === "store"} onClick={openStore}>
                {busy === "store" ? "…" : j.store.state === "none" ? "Open your store" : "Publish to the auction"}
              </button>
            )}
            {j && j.store.state === "none" && !j.canClaimStore && surfaces && (
              <button
                type="button"
                className="eac-jt-btn eac-jt-btn--primary"
                onClick={(e) => surfaces.open({ type: "journey", id: "site" }, e.currentTarget)}
              >
                Start an organisation
              </button>
            )}
            {store && (
              <a className="eac-jt-btn" href={store} target="_blank" rel="noopener">
                See it as a visitor →
              </a>
            )}
            {api?.links.auctionSite && (
              <a className="eac-jt-link" href={api.links.auctionSite} target="_blank" rel="noopener">
                The auction site →
              </a>
            )}
          </div>
        </section>

        <section className="eac-jt-step" data-state={st[2]}>
          <span className="eac-jt-step-tag">Step 3 · {LABEL[st[2]]}</span>
          <h3>Set up your payout</h3>
          <p>
            {!j || !j.payouts.available
              ? "Card payments are not switched on for this site yet."
              : j.payouts.state === "ready"
                ? "Stripe is connected. A sale pays you directly."
                : j.payouts.state === "pending"
                  ? "Stripe has some of your details. Finish and sales pay you directly."
                  : "Sales are paid to you through Stripe. Choose your country, then Stripe asks for identity and bank details on its own pages. You can list and sell before this is done; your share is held until it is."}
          </p>
          {j?.payouts.available && j.payouts.state !== "ready" && payoutApi?.startPayouts && (
            <div className="eac-jt-controls">
              {needsCountry && (
                <label className="eac-jt-field eac-jt-field--inline">
                  <span>Country</span>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="">Choose…</option>
                    {PAYOUT_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="eac-jt-btn eac-jt-btn--dark" disabled={busy === "payouts" || (needsCountry && !country)} onClick={connect}>
                {busy === "payouts" ? "…" : j.payouts.state === "pending" ? "Finish with Stripe" : "Connect Stripe"}
              </button>
            </div>
          )}
        </section>
        <Notice text={notice} tone="error" />
      </div>
    </div>
  );
}

const LABEL: Record<StepState, string> = { done: "done", next: "next", todo: "to do" };

// ── Your organisation ────────────────────────────────────────────────────────

export function OrgPanel({ orgId }: { orgId: string }) {
  const surfaces = useSurfaceOptional();
  const people = surfaces?.connectors.orgPeople;
  const links = surfaces?.connectors.journey?.links;
  const [sub, setSub] = React.useState<"details" | "people">("details");
  const [rows, setRows] = React.useState<SurfaceOrgPerson[] | null>(null);
  const [identity, setIdentity] = React.useState<SurfaceProfile | null>(null);
  React.useEffect(() => {
    if (!people) return;
    people.list(orgId).then(setRows).catch(() => setRows([]));
  }, [people, orgId]);
  React.useEffect(() => {
    surfaces?.connectors.profile?.load({ kind: "org", orgId }).then(setIdentity).catch(() => {});
  }, [surfaces, orgId]);
  const newCount = rows?.filter((r) => r.isNew).length ?? 0;
  const org = {
    orgId,
    orgName: identity?.displayName ?? "your organisation",
    hasHeadline: Boolean(identity?.headline && identity.bio),
    hasImage: Boolean(identity?.avatarUrl),
    hasPlace: Boolean(identity?.city),
    manageHref: people?.manageHref ?? null,
    homeUrl: links?.orgSite ?? null,
  };

  return (
    <div className="eac-jt-body">
      <Rail kicker={`Your organisation · ${org.orgName}`} title="Set up your organisation">
        <RailSteps
          steps={[
            { label: "Name, headline, about", done: org.hasHeadline },
            { label: "Display image and place", note: !org.hasImage ? "no image yet" : !org.hasPlace ? "no place yet" : null, done: org.hasImage && org.hasPlace },
            { label: "People and roles", note: newCount ? `${newCount} new sign-up${newCount === 1 ? "" : "s"} waiting` : null, done: newCount === 0 && rows !== null },
          ]}
        />
        <div className="eac-jt-rail-foot">
          {(people?.manageHref ?? org.manageHref) && <a href={people?.manageHref ?? org.manageHref ?? "#"}>The full manage console →</a>}
          {org.homeUrl && (
            <a href={org.homeUrl} target="_blank" rel="noopener">
              Open the site →
            </a>
          )}
        </div>
      </Rail>
      <div className="eac-jt-main">
        <SubTabs<"details" | "people">
          items={[
            { id: "details", label: "Details" },
            ...(people ? [{ id: "people" as const, label: "People", badge: newCount }] : []),
          ]}
          value={sub}
          onChange={setSub}
        />
        {sub === "details" && (
          <IdentityForm
            target={{ kind: "org", orgId: org.orgId }}
            note="Shows on the site's About, the org card and the network directory."
            onSaved={setIdentity}
          />
        )}
        {sub === "people" && people && <PeopleTable orgId={org.orgId} rows={rows} setRows={setRows} />}
      </div>
    </div>
  );
}

function PeopleTable({ orgId, rows, setRows }: { orgId: string; rows: SurfaceOrgPerson[] | null; setRows: (r: SurfaceOrgPerson[]) => void }) {
  const surfaces = useSurfaceOptional();
  const people = surfaces!.connectors.orgPeople!;
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  if (!rows) return <p className="eac-jt-muted">Loading…</p>;
  if (rows.length === 0) return <p className="eac-jt-muted">Nobody yet.</p>;

  async function role(r: SurfaceOrgPerson, value: "viewer" | "member" | "guide") {
    setBusy(r.userId);
    setNotice(null);
    const res = await people.setRole(orgId, r.userId, value).catch(() => ({ ok: false, error: "Could not save that." }));
    setBusy(null);
    if (!res.ok) return setNotice(res.error ?? "Could not save that.");
    setRows(rows!.map((x) => (x.userId === r.userId ? { ...x, role: value, isNew: false } : x)));
  }
  async function listed(r: SurfaceOrgPerson, on: boolean) {
    setBusy(r.userId);
    setNotice(null);
    const res = await people.setListed(orgId, r.userId, on).catch(() => ({ ok: false, error: "Could not save that." }));
    setBusy(null);
    if (!res.ok) return setNotice(res.error ?? "Could not save that.");
    setRows(rows!.map((x) => (x.userId === r.userId ? { ...x, listing: x.listing ? { ...x.listing, isPublic: on } : { isPublic: on, slug: null, kind: "artist" } } : x)));
  }
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

  return (
    <div className="eac-jt-people">
      <p className="eac-jt-muted">Access and listing are separate: a viewer follows; a member takes part; a guide edits and manages. Listed means the public site shows them.</p>
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Arrived</th>
            <th>Access</th>
            <th>On the site</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} data-new={r.isNew || undefined}>
              <td>
                <span className="eac-jt-person">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" />
                  ) : (
                    <span className="eac-jt-person-blank" aria-hidden />
                  )}
                  <span>
                    <strong>{r.displayName ?? r.email}</strong>
                    {r.isNew && <em className="eac-jt-new">new</em>}
                    <small>{r.email}</small>
                  </span>
                </span>
              </td>
              <td>
                {when(r.arrivedAt ?? r.joinedAt)}
                {r.arrivedFrom && <small> · from {r.arrivedFrom}</small>}
              </td>
              <td>
                {r.role === "owner" ? (
                  "Owner"
                ) : (
                  <select value={r.role} disabled={busy === r.userId} onChange={(e) => role(r, e.target.value as "viewer" | "member" | "guide")}>
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="guide">Guide</option>
                  </select>
                )}
              </td>
              <td>
                <label className="eac-jt-check">
                  <input type="checkbox" checked={Boolean(r.listing?.isPublic)} disabled={busy === r.userId} onChange={(e) => listed(r, e.target.checked)} />
                  listed
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Notice text={notice} tone="error" />
    </div>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────

type PageState = Awaited<ReturnType<NonNullable<NonNullable<ReturnType<typeof useSurfaceOptional>>["connectors"]["profile"]>["page"] extends infer P ? P extends { load: () => Promise<infer R> } ? () => Promise<R> : never : never>> | null;

/**
 * `bare` (the `me` surface, 2026-10-31): no rail, and a Connections tab when
 * the host serves connections. The journey dialog keeps the rail.
 */
export function ProfilePanel({ bare = false, initialTab = null }: { bare?: boolean; initialTab?: SurfaceMeTab | null } = {}) {
  const surfaces = useSurfaceOptional();
  const presence = surfaces?.connectors.profile?.presence;
  const pageApi = surfaces?.connectors.profile?.page;
  const servicesApi = surfaces?.connectors.services;
  const connections = bare ? surfaces?.connectors.profile?.connections : undefined;
  const [sub, setSub] = React.useState<SurfaceMeTab>(initialTab ?? "details");
  const [profile, setProfile] = React.useState<SurfaceProfile | null>(null);
  const [page, setPage] = React.useState<PageState>(null);
  const [services, setServices] = React.useState<SurfaceOwnService[] | null>(null);

  const reloadPage = React.useCallback(() => {
    pageApi?.load().then((r) => setPage(r as PageState)).catch(() => {});
  }, [pageApi]);
  const reloadServices = React.useCallback(() => {
    servicesApi?.list().then(setServices).catch(() => setServices([]));
  }, [servicesApi]);
  React.useEffect(() => {
    surfaces?.connectors.profile?.load(undefined).then(setProfile).catch(() => {});
  }, [surfaces]);
  React.useEffect(() => reloadPage(), [reloadPage]);
  React.useEffect(() => reloadServices(), [reloadServices]);

  if (!surfaces?.connectors.profile) {
    return (
      <div className={bare ? "eac-jt-body eac-jt-body--bare" : "eac-jt-body"}>
        {!bare && <Rail kicker="Artist directory" title="Your listing" />}
        <div className="eac-jt-main">
          <p className="eac-jt-muted">This site does not serve profile editing here.</p>
        </div>
      </div>
    );
  }

  const storeOn = Boolean(page?.sections.find((x) => x.key === "store")?.on);
  const published = services?.filter((x) => x.status === "published").length ?? 0;
  const payoutReady = page?.payouts?.state === "ready";
  const done = [
    Boolean(profile?.displayName && profile.avatarUrl && profile.headline),
    published > 0 || storeOn,
    payoutReady,
  ];
  return (
    <div className={bare ? "eac-jt-body eac-jt-body--bare" : "eac-jt-body"}>
      {!bare && <Rail kicker="Artist directory" title="Your listing">
        <p className="eac-jt-rail-copy">
          The artist directory is a space for you as an individual, apart from any organisation: who you are as an artist, what you make, trade or offer, and where to find you.
        </p>
        <RailSteps
          steps={[
            { label: "Your profile", note: profile?.headline ? null : "add a headline and portrait", done: done[0] },
            {
              label: "What you offer",
              note: published > 0 ? `${published} service${published === 1 ? "" : "s"} live` : storeOn ? "store on your page" : "a service or your art",
              done: done[1],
            },
            { label: "Get paid", note: payoutReady ? "Stripe connected" : "Stripe not connected", done: done[2] },
          ]}
        />
        <div className="eac-jt-rail-foot">
          {profile?.pageHref && (
            <a href={profile.pageHref} target="_blank" rel="noopener">
              See your page as a visitor →
            </a>
          )}
        </div>
      </Rail>}
      <div className="eac-jt-main">
        <SubTabs<SurfaceMeTab>
          items={[
            { id: "details", label: "Details" },
            { id: "offer", label: "Offer & get paid" },
            ...(presence ? [{ id: "show" as const, label: "Where you show" }] : []),
            { id: "links" as const, label: "Links" },
            ...(connections ? [{ id: "connections" as const, label: "Connections" }] : []),
          ]}
          value={sub}
          onChange={setSub}
        />
        {sub === "details" && <IdentityForm target={undefined} note="One profile, everywhere you appear on the network." onSaved={setProfile} />}
        {sub === "offer" && (
          <OfferTab page={page} reloadPage={reloadPage} services={services} reloadServices={reloadServices} />
        )}
        {sub === "show" && presence && <PresenceMatrix />}
        {sub === "links" && <LinksForm />}
        {sub === "connections" && connections && (
          <ConnectionsPanel
            api={connections}
            // Back to this tab after consent: the address with the tab in it.
            returnTo={typeof window === "undefined" ? undefined : window.location.origin + urlWithSurface(serializeDescriptor({ type: "me", tab: "connections" }))}
            intro={
              <p className="eac-jt-muted">
                Your own accounts on outside services. Connect Facebook &amp; Instagram or Threads to post your pieces
                there from the Studio. A YouTube connection lets recordings of your groups go to your channel.
              </p>
            }
          />
        )}
      </div>
    </div>
  );
}

// ── Offer & get paid: services and art on your page, and the payout they need ──

function OfferTab({
  page,
  reloadPage,
  services,
  reloadServices,
}: {
  page: PageState;
  reloadPage: () => void;
  services: SurfaceOwnService[] | null;
  reloadServices: () => void;
}) {
  const surfaces = useSurfaceOptional();
  const servicesApi = surfaces?.connectors.services;
  const pageApi = surfaces?.connectors.profile?.page;
  const journeyApi = surfaces?.connectors.journey;
  const [editing, setEditing] = React.useState<{ id: string | null; title: string; shortDescription: string; price: string; format: "online" | "in_person" | "hybrid" } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");
  const [auction, setAuction] = React.useState<SurfaceAuctionJourney | null>(null);
  React.useEffect(() => {
    journeyApi?.load("auction").then(setAuction).catch(() => {});
  }, [journeyApi]);

  const say = (t: "normal" | "error", m: string) => {
    setTone(t);
    setNotice(m);
  };
  const store = page?.sections.find((x) => x.key === "store") ?? null;
  const payouts = page?.payouts ?? null;
  const priced = (services ?? []).some((x) => x.price > 0 && x.status === "published");

  async function saveService(status: "draft" | "published") {
    if (!servicesApi || !editing) return;
    setBusy("service");
    setNotice(null);
    const r = await servicesApi
      .save({ title: editing.title, shortDescription: editing.shortDescription, price: editing.price, format: editing.format, status }, editing.id)
      .catch(() => ({ ok: false as const, error: "Could not save." }));
    setBusy(null);
    if (r.ok === false) return say("error", r.error);
    setEditing(null);
    say("normal", status === "published" ? "Published on your page." : "Saved as a draft.");
    reloadServices();
  }
  async function toggleService(x: SurfaceOwnService) {
    if (!servicesApi) return;
    setBusy(x.id);
    const r = await servicesApi.setStatus(x.id, x.status === "published" ? "draft" : "published").catch(() => ({ ok: false, error: "Could not change that." }));
    setBusy(null);
    if (!r.ok) return say("error", r.error ?? "Could not change that.");
    reloadServices();
  }
  async function toggleStore(on: boolean) {
    if (!pageApi) return;
    setBusy("store");
    const r = await pageApi.setSection("store", on).catch(() => ({ ok: false as const, error: "Could not change that." }));
    setBusy(null);
    if (r.ok === false) return say("error", r.error);
    reloadPage();
  }
  async function openStore() {
    if (!journeyApi) return;
    setBusy("open-store");
    const r = await journeyApi.publishStore().catch(() => ({ ok: false as const, error: "Could not open a store." }));
    setBusy(null);
    if (r.ok === false) return say("error", r.error);
    journeyApi.load("auction").then(setAuction).catch(() => {});
    reloadPage();
  }

  return (
    <div className="eac-jt-offer">
      {servicesApi && (
        <section className="eac-jt-step" data-state={(services ?? []).some((x) => x.status === "published") ? "done" : "next"}>
          <h3>Offer a service</h3>
          <p>
            Readings, lessons, commissions, sessions, anything you do for people. It appears on your ArtDirect page and visitors
            book and pay by card there.
          </p>
          {(services ?? []).length > 0 && (
            <ul className="eac-jt-list">
              {(services ?? []).map((x) => (
                <li key={x.id}>
                  <span>
                    <strong>{x.title}</strong>
                    <small>
                      {x.price > 0 ? `$${x.price.toFixed(2)} ${x.currency}` : "free"} · {x.status === "published" ? "live" : "draft"}
                    </small>
                  </span>
                  <span className="eac-jt-list-actions">
                    <button
                      type="button"
                      className="eac-jt-link"
                      onClick={() =>
                        setEditing({ id: x.id, title: x.title, shortDescription: x.shortDescription ?? "", price: x.price ? String(x.price) : "", format: x.format ?? "online" })
                      }
                    >
                      Edit
                    </button>
                    <button type="button" className="eac-jt-link" disabled={busy === x.id} onClick={() => toggleService(x)}>
                      {x.status === "published" ? "Take down" : "Publish"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {editing ? (
            <div className="eac-jt-form">
              <div className="eac-jt-fields">
                <label className="eac-jt-field eac-jt-field--wide">
                  <span>What you offer</span>
                  <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="A one-hour portrait session" />
                </label>
                <label className="eac-jt-field">
                  <span>Price (CAD)</span>
                  <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} inputMode="decimal" placeholder="blank = free" />
                </label>
                <label className="eac-jt-field">
                  <span>Where</span>
                  <select value={editing.format} onChange={(e) => setEditing({ ...editing, format: e.target.value as "online" | "in_person" | "hybrid" })}>
                    <option value="online">Online</option>
                    <option value="in_person">In person</option>
                    <option value="hybrid">Either</option>
                  </select>
                </label>
                <label className="eac-jt-field eac-jt-field--wide">
                  <span>A few lines about it</span>
                  <textarea value={editing.shortDescription} onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })} />
                </label>
              </div>
              <div className="eac-jt-controls">
                <button type="button" className="eac-jt-btn eac-jt-btn--primary" disabled={busy === "service" || editing.title.trim().length < 2} onClick={() => saveService("published")}>
                  {busy === "service" ? "…" : "Publish"}
                </button>
                <button type="button" className="eac-jt-btn" disabled={busy === "service" || editing.title.trim().length < 2} onClick={() => saveService("draft")}>
                  Save as draft
                </button>
                <button type="button" className="eac-jt-link" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="eac-jt-controls">
              <button type="button" className="eac-jt-btn eac-jt-btn--primary" onClick={() => setEditing({ id: null, title: "", shortDescription: "", price: "", format: "online" })}>
                {(services ?? []).length ? "Offer another" : "Offer a service"}
              </button>
            </div>
          )}
        </section>
      )}

      {store && (
        <section className="eac-jt-step" data-state={store.on ? "done" : "todo"}>
          <h3>Sell your art on your page</h3>
          {auction?.store.state === "active" ? (
            <>
              <p>Your store is open. Show it on your ArtDirect page and visitors buy from you directly.</p>
              <label className="eac-jt-check eac-jt-check--big">
                <input type="checkbox" checked={store.on} disabled={busy === "store"} onChange={(e) => toggleStore(e.target.checked)} />
                Show my store on my page
              </label>
            </>
          ) : (
            <>
              <p>
                {auction?.canClaimStore
                  ? "You have no store yet. One click opens one under your name; the collective keeps 5% of each sale."
                  : "A store is for members of the collective. Start an organisation of your own, or ask the organisers of the site you came from to make you a member."}
              </p>
              <div className="eac-jt-controls">
                {auction?.canClaimStore && journeyApi ? (
                  <button type="button" className="eac-jt-btn eac-jt-btn--primary" disabled={busy === "open-store"} onClick={openStore}>
                    {busy === "open-store" ? "…" : "Open your store"}
                  </button>
                ) : (
                  surfaces && (
                    <button type="button" className="eac-jt-btn" onClick={(e) => surfaces.open({ type: "journey", id: "site" }, e.currentTarget)}>
                      Start an organisation
                    </button>
                  )
                )}
                {surfaces && (
                  <button type="button" className="eac-jt-link" onClick={(e) => surfaces.open({ type: "journey", id: "auction" }, e.currentTarget)}>
                    The selling-art journey →
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {payouts && pageApi?.startPayouts && (
        <PayoutBlock payouts={payouts} priced={priced || store?.on === true} />
      )}
      <Notice text={notice} tone={tone} />
    </div>
  );
}

/** Connect Stripe, in the profile journey: services and sales on your page pay out through it. */
function PayoutBlock({ payouts, priced }: { payouts: NonNullable<NonNullable<PageState>["payouts"]>; priced: boolean }) {
  const surfaces = useSurfaceOptional();
  const api = surfaces?.connectors.profile?.page;
  const [country, setCountry] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const needsCountry = payouts.available && payouts.state === "none" && !payouts.country;
  async function connect() {
    if (!api?.startPayouts) return;
    setBusy(true);
    setNotice(null);
    const r = await api.startPayouts(needsCountry ? country : undefined).catch(() => ({ ok: false as const, error: "Could not reach Stripe." }));
    setBusy(false);
    if (r.ok === false) return setNotice(r.error || "Could not reach Stripe.");
    window.location.assign(r.url);
  }
  return (
    <section className="eac-jt-step" data-state={payouts.state === "ready" ? "done" : priced ? "next" : "todo"}>
      <h3>Get paid</h3>
      <p>
        {!payouts.available
          ? "Card payments are not switched on for this site yet."
          : payouts.state === "ready"
            ? "Stripe is connected. Bookings and sales on your page pay you directly."
            : payouts.state === "pending"
              ? "Stripe has some of your details. Finish and bookings and sales pay you directly."
              : "Bookings and sales are paid to you through Stripe. Choose your country, then Stripe asks for identity and bank details on its own pages. Stripe takes 2.9% + 30¢ per card payment."}
      </p>
      {payouts.available && payouts.state !== "ready" && (
        <div className="eac-jt-controls">
          {needsCountry && (
            <label className="eac-jt-field eac-jt-field--inline">
              <span>Country</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Choose…</option>
                {PAYOUT_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="eac-jt-btn eac-jt-btn--dark" disabled={busy || (needsCountry && !country)} onClick={connect}>
            {busy ? "…" : payouts.state === "pending" ? "Finish with Stripe" : "Connect Stripe"}
          </button>
        </div>
      )}
      <Notice text={notice} tone="error" />
    </section>
  );
}

// ── The identity form (person or org), writing through connectors.profile ──

function IdentityForm({ target, note, onSaved }: { target: { kind: "org"; orgId: string } | undefined; note: string; onSaved?: (p: SurfaceProfile) => void }) {
  const surfaces = useSurfaceOptional();
  const api = surfaces!.connectors.profile!;
  const [p, setP] = React.useState<SurfaceProfile | null>(null);
  const [d, setD] = React.useState<SurfaceProfileInput>({});
  const [busy, setBusy] = React.useState<"save" | "upload" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    api
      .load(target)
      .then((x) => {
        setP(x);
        if (x)
          setD({
            displayName: x.displayName,
            headline: x.headline ?? "",
            bio: x.bio ?? "",
            pronouns: x.pronouns ?? "",
            city: x.city ?? "",
            region: x.region ?? "",
            country: x.country ?? "",
            avatarUrl: x.avatarUrl,
          });
      })
      .catch(() => setP(null));
  }, [api, target?.orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof SurfaceProfileInput, v: string) => setD((x) => ({ ...x, [k]: v }));
  const nz = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setNotice(null);
    const r = await api
      .save(target, {
        displayName: (d.displayName ?? "").trim(),
        headline: nz(d.headline),
        bio: nz(d.bio),
        pronouns: target ? undefined : nz(d.pronouns),
        city: nz(d.city),
        region: nz(d.region),
        country: nz(d.country),
        avatarUrl: d.avatarUrl ?? null,
      })
      .catch(() => ({ ok: false as const, error: "Could not save." }));
    setBusy(null);
    if (r.ok === false) {
      setTone("error");
      return setNotice(r.error);
    }
    setTone("normal");
    setNotice("Saved.");
    surfaces?.connectors.onMutated?.();
    const fresh = await api.load(target).catch(() => null);
    if (fresh) {
      setP(fresh);
      onSaved?.(fresh);
    }
  }
  async function upload(file: File) {
    if (!api.uploadAvatar) return;
    setBusy("upload");
    const r = await api.uploadAvatar(file).catch(() => ({ ok: false as const, error: "Upload failed." }));
    setBusy(null);
    if (r.ok === false) {
      setTone("error");
      return setNotice(r.error);
    }
    setD((x) => ({ ...x, avatarUrl: r.url }));
  }

  if (p === null) return <p className="eac-jt-muted">Loading…</p>;
  const isOrg = Boolean(target);
  return (
    <form className="eac-jt-form" onSubmit={save}>
      <div className="eac-jt-form-grid">
        <div className="eac-jt-image">
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.avatarUrl} alt="" />
          ) : (
            <span className="eac-jt-image-blank">{isOrg ? "display image" : "portrait"}</span>
          )}
          {api.uploadAvatar && (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button type="button" className="eac-jt-link" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>
                {busy === "upload" ? "Uploading…" : d.avatarUrl ? "Change image" : "Add an image"}
              </button>
            </>
          )}
        </div>
        <div className="eac-jt-fields">
          <label className="eac-jt-field eac-jt-field--wide">
            <span>{isOrg ? "Name" : "Display name"}</span>
            <input value={d.displayName ?? ""} onChange={(e) => set("displayName", e.target.value)} required />
          </label>
          {!isOrg && (
            <label className="eac-jt-field">
              <span>Pronouns</span>
              <input value={d.pronouns ?? ""} onChange={(e) => set("pronouns", e.target.value)} />
            </label>
          )}
          <label className={`eac-jt-field${isOrg ? " eac-jt-field--wide" : ""}`}>
            <span>Headline</span>
            <input value={d.headline ?? ""} onChange={(e) => set("headline", e.target.value)} placeholder={isOrg ? "What the organisation does, in a line" : "What you do, in a line"} />
          </label>
          <label className="eac-jt-field">
            <span>City</span>
            <input value={d.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="eac-jt-field">
            <span>Region / country</span>
            <span className="eac-jt-pair">
              <input value={d.region ?? ""} onChange={(e) => set("region", e.target.value)} placeholder="Region" />
              <input value={d.country ?? ""} onChange={(e) => set("country", e.target.value)} placeholder="Country" />
            </span>
          </label>
          <label className="eac-jt-field eac-jt-field--wide">
            <span>{isOrg ? "About" : "Statement"}</span>
            <textarea value={d.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
          </label>
        </div>
      </div>
      <div className="eac-jt-controls">
        <button type="submit" className="eac-jt-btn eac-jt-btn--primary" disabled={busy !== null || !p.canEdit}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <span className="eac-jt-muted">{note}</span>
      </div>
      <Notice text={notice} tone={tone} />
    </form>
  );
}

function LinksForm() {
  const surfaces = useSurfaceOptional();
  const api = surfaces!.connectors.profile!;
  const [links, setLinks] = React.useState<SurfaceProfileLink[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    api.load(undefined).then((p) => setLinks(p?.socialLinks ?? [])).catch(() => setLinks([]));
  }, [api]);
  if (!links) return <p className="eac-jt-muted">Loading…</p>;
  async function save() {
    setBusy(true);
    const r = await api.save(undefined, { socialLinks: links!.filter((l) => l.url.trim()) }).catch(() => ({ ok: false as const, error: "Could not save." }));
    setBusy(false);
    setNotice(r.ok === false ? r.error : "Saved.");
  }
  return (
    <div className="eac-jt-form">
      <p className="eac-jt-muted">Your website, shop, social accounts. Shown on your page and your card.</p>
      <div className="eac-jt-links">
        {links.map((l, i) => (
          <div key={i} className="eac-jt-linkrow">
            <input value={l.label ?? ""} placeholder="Label" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value || null } : x)))} />
            <input value={l.url} placeholder="https://" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <button type="button" className="eac-jt-link" aria-label="Remove link" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="eac-jt-link" onClick={() => setLinks([...links, { label: null, url: "" }])}>
          + Add a link
        </button>
      </div>
      <div className="eac-jt-controls">
        <button type="button" className="eac-jt-btn eac-jt-btn--primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <Notice text={notice} tone="normal" />
    </div>
  );
}

function PresenceMatrix() {
  const surfaces = useSurfaceOptional();
  const api = surfaces!.connectors.profile!.presence!;
  const [data, setData] = React.useState<SurfacePresence | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const load = React.useCallback(() => api.load().then(setData).catch(() => setData({ columns: [], rows: [] })), [api]);
  React.useEffect(() => {
    load();
  }, [load]);
  if (!data) return <p className="eac-jt-muted">Loading…</p>;
  if (data.rows.length === 0) return <p className="eac-jt-muted">Nothing to place yet. Publish something and it will appear here.</p>;

  async function flip(row: SurfacePresence["rows"][number], col: string, on: boolean) {
    const key = `${row.key}|${col}`;
    setBusy(key);
    setNotice(null);
    const r = await api.set({ row: row.key, column: col, on }).catch(() => ({ ok: false as const, error: "Could not change that." }));
    setBusy(null);
    if (r.ok === false) return setNotice(r.error);
    if (r.ok && r.pending) setNotice("Asked. The organisers decide.");
    load();
  }
  const cell = (row: SurfacePresence["rows"][number], colKey: string, c: SurfacePresenceCell) => {
    const key = `${row.key}|${colKey}`;
    if (c.state === "status") return <span className="eac-jt-muted">{c.label}</span>;
    if (c.state === "request")
      return c.pending ? (
        <span className="eac-jt-muted">Requested</span>
      ) : (
        <button type="button" className="eac-jt-link" disabled={busy === key} onClick={() => flip(row, colKey, true)}>
          Ask to be shown
        </button>
      );
    return <input type="checkbox" checked={c.on} disabled={busy === key} onChange={(e) => flip(row, colKey, e.target.checked)} aria-label={`${row.label} on ${colKey}`} />;
  };
  return (
    <div className="eac-jt-people">
      <p className="eac-jt-muted">Switches work at once. Showing on an organisation's site is its organisers' call; you can hide yourself any time and ask to be shown.</p>
      <table>
        <thead>
          <tr>
            <th />
            {data.columns.map((c) => (
              <th key={c.key}>{c.href ? <a href={c.href} target="_blank" rel="noopener">{c.label}</a> : c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {data.columns.map((c) => (
                <td key={c.key}>{row.cells[c.key] ? cell(row, c.key, row.cells[c.key]) : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Notice text={notice} tone="normal" />
    </div>
  );
}


// ── Start an organisation ────────────────────────────────────────────────────

const slugify = (raw: string) =>
  raw
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function SitePanel() {
  const surfaces = useSurfaceOptional();
  const api = surfaces?.connectors.journey?.site;
  const startElsewhere = surfaces?.connectors.journey?.links.startOrg ?? null;
  const [title, setTitle] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [check, setCheck] = React.useState<{ slug: string; ok: boolean; reason?: "invalid" | "taken" } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ slug: string } | null>(null);

  // The address follows the name until the person edits it themselves.
  const effective = touched ? address : slugify(title);
  React.useEffect(() => {
    if (!api || created) return;
    const slug = slugify(effective);
    if (slug.length < 3) {
      setCheck(null);
      return;
    }
    const t = window.setTimeout(() => {
      api.check(slug).then(setCheck).catch(() => setCheck(null));
    }, 350);
    return () => window.clearTimeout(t);
  }, [api, effective, created]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!api) return;
    setBusy(true);
    setError(null);
    const r = await api.create({ title: title.trim(), subdomain: slugify(effective) }).catch(() => ({ ok: false as const, error: "Could not reach the network." }));
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    setCreated({ slug: r.slug });
    surfaces?.connectors.onMutated?.();
  }

  const host = api?.networkHost ?? "arts-collective.com";
  const slug = slugify(effective);
  const valid = title.trim().length >= 2 && check?.ok === true && check.slug === slug;
  const hint =
    !slug || slug.length < 3
      ? "At least three letters or numbers."
      : !check || check.slug !== slug
        ? "Checking…"
        : check.ok
          ? "Available."
          : check.reason === "taken"
            ? "That address is taken."
            : "That address is not allowed. Try another.";

  return (
    <div className="eac-jt-body">
      <Rail kicker="arts-collective.com" title="Create a collective">
        <p className="eac-jt-rail-copy">
          A site of your own on the collective: a name, an address under {host}, a hub for your people, and everything an
          organisation here can do: events, writing, a store, services.
        </p>
        <RailSteps
          steps={[
            { label: "Name it and choose its address", done: Boolean(created) },
            { label: "Say what it is for", done: false },
            { label: "Invite people", done: false },
          ]}
        />
      </Rail>
      <div className="eac-jt-main">
        <p className="eac-jt-dev" role="note">
          <strong>Currently in development.</strong> Starting a collective here is being built; what you see is how it will work.
        </p>
        {created ? (
          <>
            <section className="eac-jt-step" data-state="done">
              <span className="eac-jt-step-tag">Step 1 · done</span>
              <h3>{title.trim() || created.slug} exists</h3>
              <p>
                Your organisation is <strong>{created.slug}.{host}</strong>, and you are its owner. It begins with a short intake
                conversation with the collective, after which an admin confirms it and the public sees the site. You see
                the real site throughout, so you can start building now.
              </p>
              <div className="eac-jt-controls">
                {surfaces && (
                  <button
                    type="button"
                    className="eac-jt-btn eac-jt-btn--primary"
                    onClick={(e) => surfaces.open({ type: "journey", id: "org", orgId: created.slug }, e.currentTarget)}
                  >
                    Set up {title.trim() || created.slug}
                  </button>
                )}
                {api?.manageHref(created.slug) && (
                  <a className="eac-jt-btn" href={api.manageHref(created.slug) ?? "#"}>
                    Open its console
                  </a>
                )}
              </div>
            </section>
            <p className="eac-jt-muted">
              The address answers once the collective's operator has added it to the edge; until then your organisation is
              reachable from its console.
            </p>
          </>
        ) : (
          <>
            <form className="eac-jt-step" data-state="next" onSubmit={create}>
              <span className="eac-jt-step-tag">Step 1 · next</span>
              <h3>Name it and choose its address</h3>
              <p>
                The name can change later. The address is what people will link to, so choose it with care; a domain of your
                own can be pointed at it afterwards.
              </p>
              {api ? (
                <div className="eac-jt-form">
                  <label className="eac-jt-field eac-jt-field--wide">
                    <span>Name</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Riverbend Print Studio" maxLength={120} autoComplete="off" />
                  </label>
                  <label className="eac-jt-field eac-jt-field--wide">
                    <span>Address</span>
                    <span className="eac-jt-address">
                      <input
                        value={effective}
                        onChange={(e) => {
                          setTouched(true);
                          setAddress(e.target.value);
                        }}
                        placeholder="riverbend"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span aria-hidden>.{host}</span>
                    </span>
                  </label>
                  <p className="eac-jt-address-hint" data-ok={check?.ok && check.slug === slug ? "" : undefined}>
                    {slug ? <strong>{slug}.{host}</strong> : null} {slug ? "· " : ""}{hint}
                  </p>
                  <div className="eac-jt-controls">
                    <button type="submit" className="eac-jt-btn eac-jt-btn--primary" disabled={busy || !valid}>
                      {busy ? "Creating…" : "Create the organisation"}
                    </button>
                  </div>
                  <Notice text={error} tone="error" />
                </div>
              ) : startElsewhere ? (
                <div className="eac-jt-controls">
                  <a className="eac-jt-btn eac-jt-btn--primary" href={startElsewhere}>
                    Start on arts-collective.com
                  </a>
                </div>
              ) : (
                <p className="eac-jt-muted">Starting an organisation is done on the network hub.</p>
              )}
            </form>
            <section className="eac-jt-step" data-state="todo">
              <span className="eac-jt-step-tag">Step 2 · to do</span>
              <h3>Say what it is for</h3>
              <p>A headline and a few lines; whether it is a group, a studio, a school, a market. This becomes its page and its card across the network.</p>
            </section>
            <section className="eac-jt-step" data-state="todo">
              <span className="eac-jt-step-tag">Step 3 · to do</span>
              <h3>Invite people</h3>
              <p>Members take part; guides edit and manage; followers read. People you invite sign in once for the whole network.</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
