"use client";

import * as React from "react";
import { useSurface } from "../surface/context";
import type { SurfaceOffer, SurfaceSiteData } from "./types";
import { SurfaceIcon, type SurfaceIconKind } from "./icons";
import { useOfferEnv } from "./env";
import { layerFor, offerDescriptor } from "./descriptor";
import { fmtMoney, monoWhen } from "./format";

// ============================================================================
// Page-level pieces of the handoff's "profile page with a featured offer"
// (section B). Each takes the site data (or reads it from the root) and opens
// layers through the surface stack. They draw inside <OfferSurfaceRoot>.
// ============================================================================

const KIND_ICON: Record<SurfaceOffer["kind"], SurfaceIconKind> = { event: "evt", service: "svc", series: "ser", artwork: "art", writing: "wr" };

export function useOpenOffer() {
  const { open } = useSurface();
  return React.useCallback(
    (offer: SurfaceOffer, origin?: HTMLElement | null, featured?: boolean) => {
      const layer = layerFor(offer);
      if (!layer) return false;
      open(offerDescriptor(layer, offer.key, featured ? { featured: true } : undefined), origin ?? undefined);
      return true;
    },
    [open]
  );
}

function offerLine(o: SurfaceOffer): string {
  const bits: string[] = [];
  if (o.kind === "event" && o.when?.start) bits.push(monoWhen(o.when.start, o.when.timeZone));
  if (o.kind !== "event" && o.price) bits.push(fmtMoney(o.price));
  if (o.kind === "service" && o.durationMinutes) bits.push(`${o.durationMinutes} MIN`);
  if (o.kind === "artwork" && o.artwork?.edition) bits.push(o.artwork.edition.toUpperCase());
  if (o.kind === "event" && o.price) bits.push(fmtMoney(o.price));
  return bits.join(" · ");
}

function KindBox({ kind, size = 30 }: { kind: SurfaceOffer["kind"]; size?: number }) {
  const env = useOfferEnv();
  return (
    <span className="osf-kbox" style={{ ["--osf-kc" as string]: `var(--os-kind-${kind})`, width: size, height: size }}>
      <SurfaceIcon kind={KIND_ICON[kind]} set={env.data.look.icons} size={14} />
    </span>
  );
}

/** Site name, Profile, + Follow. */
export function OfferTopBar({ data }: { data: SurfaceSiteData }) {
  const { open } = useSurface();
  const env = useOfferEnv();
  const following = env.isFollowing(data.owner.id);
  return (
    <nav className="osf-top" aria-label="Site">
      <span className="osf-sitename">{data.site.name}</span>
      <span className="osf-top-links">
        <span className="osf-toplink is-active" aria-current="page">Profile</span>
        <button
          type="button"
          className={`osf-toplink is-follow${following ? " is-on" : ""}`}
          onClick={(e) => (following ? open(offerDescriptor("pf-owner", data.owner.id), e.currentTarget) : open(offerDescriptor("follow", data.owner.id, { flow: "fol" }), e.currentTarget))}
        >
          {following ? "✓ Following" : "+ Follow"}
        </button>
      </span>
    </nav>
  );
}

/** Photo, name, role, bio, the Follow button that fills from the left, the count and links. */
export function OfferProfileHeader({ data }: { data: SurfaceSiteData }) {
  const { open } = useSurface();
  const env = useOfferEnv();
  const o = data.owner;
  const following = env.isFollowing(o.id);
  return (
    <header className="osf-phead">
      {o.portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="osf-pphoto" src={o.portrait} alt="" />
      ) : (
        <span className="osf-pphoto osf-ph" aria-hidden />
      )}
      <div className="osf-pwho">
        <h1 className="osf-pname">{o.name}</h1>
        {o.role && <span className="osf-role">{o.role}</span>}
        {o.bio && <p className="osf-pbio">{o.bio}</p>}
      </div>
      <div className="osf-pside">
        <button
          type="button"
          className={`osf-follow${following ? " is-on" : ""}`}
          onClick={(e) => (following ? open(offerDescriptor("pf-owner", o.id), e.currentTarget) : open(offerDescriptor("follow", o.id, { flow: "fol" }), e.currentTarget))}
        >
          {following ? "✓ Following" : "+ Follow"}
        </button>
        {o.followers != null && <span className="osf-mono-meta">{o.followers} FOLLOWING</span>}
        {o.links && o.links.length > 0 && (
          <span className="osf-plinks">
            {o.links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </span>
        )}
      </div>
    </header>
  );
}

/** The featured offer. Null without one. */
export function OnNowCard({ data }: { data: SurfaceSiteData }) {
  const openOffer = useOpenOffer();
  const f = data.featured;
  if (!f) return null;
  const pic = f.poster ?? f.images?.[0] ?? null;
  const label = f.kind === "event" ? (f.takeUp === "pay" ? "Get a place" : "I'm coming") : f.kind === "service" ? "Book" : f.kind === "artwork" ? "Order" : "Open";
  return (
    <section className="osf-onnow" aria-label="On now">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="osf-onnow-pic" src={pic} alt="" />
      ) : (
        <span className="osf-onnow-pic osf-ph" aria-hidden />
      )}
      <div className="osf-onnow-body">
        <span className="osf-live">
          <i aria-hidden /> ON NOW
          {f.when?.start && (
            <span suppressHydrationWarning> · {monoWhen(f.when.start, f.when.timeZone)}</span>
          )}
        </span>
        <h2 className="osf-onnow-title">{f.title}</h2>
        {f.standfirst && <p className="osf-pbio">{f.standfirst}</p>}
        <div className="osf-onnow-btns">
          <button type="button" className="osf-btn osf-btn-primary" onClick={(e) => openOffer(f, e.currentTarget, true)}>
            {label}
          </button>
          {f.href && (
            <a className="osf-btn osf-btn-quiet" href={f.href}>
              Go to its page →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** The other offers as cards. Null when there are none. */
export function AlsoOffered({ data }: { data: SurfaceSiteData }) {
  const openOffer = useOpenOffer();
  const list = data.offers.filter((o) => o.key !== data.featured?.key);
  if (list.length === 0) return null;
  return (
    <section aria-label="Also offered">
      <h2 className="osf-sech">Also offered</h2>
      <div className="osf-cards">
        {list.map((o) => {
          const inner = (
            <>
              <span className="osf-plus" aria-hidden>+</span>
              <KindBox kind={o.kind} />
              <span className="osf-mono-meta osf-cardkind">{o.kind.toUpperCase()}</span>
              <span className="osf-cardtitle">{o.title}</span>
              <span className="osf-mono-meta" suppressHydrationWarning>{offerLine(o)}</span>
            </>
          );
          return layerFor(o) ? (
            <button key={o.key} type="button" className="osf-card" onClick={(e) => openOffer(o, e.currentTarget)}>
              {inner}
            </button>
          ) : o.href ? (
            <a key={o.key} className="osf-card" href={o.href}>
              {inner}
            </a>
          ) : null;
        })}
      </div>
    </section>
  );
}

/** One lead piece beside a list. Null without writing. */
export function WritingShelf({ data, allHref }: { data: SurfaceSiteData; allHref?: string }) {
  const w = data.writing;
  if (w.length === 0) return null;
  const [lead, ...rest] = w;
  const link = (p: typeof lead, cls: string, children: React.ReactNode) =>
    p!.href ? (
      <a key={p!.key} className={cls} href={p!.href}>
        {children}
      </a>
    ) : (
      <div key={p!.key} className={cls}>
        {children}
      </div>
    );
  return (
    <section aria-label="Writing">
      <h2 className="osf-sech">Writing</h2>
      <div className="osf-shelf">
        {link(
          lead,
          "osf-lead",
          <>
            {lead!.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="osf-lead-pic" src={lead!.cover} alt="" />
            ) : (
              <span className="osf-lead-pic osf-ph" aria-hidden />
            )}
            <span className="osf-mono-meta">WRITING{lead!.minutes ? ` · ${lead!.minutes} MIN` : ""}</span>
            <span className="osf-cardtitle">{lead!.title}</span>
            {lead!.standfirst && <span className="osf-pbio">{lead!.standfirst}</span>}
          </>
        )}
        <div className="osf-list">
          {rest.map((p) =>
            link(
              p,
              "osf-listrow",
              <>
                <span className="osf-wtitle">{p.title}</span>
                {p.minutes ? <span className="osf-mono-meta">{p.minutes} MIN</span> : null}
              </>
            )
          )}
          {allHref && (
            <a className="osf-all" href={allHref}>
              All writing ({w.length}) →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** The whole page in handoff order. Hosts that want a different order use the pieces. */
export function OfferProfilePage({ data, writingHref }: { data: SurfaceSiteData; writingHref?: string }) {
  return (
    <div className="osf-page">
      <OfferTopBar data={data} />
      <OfferProfileHeader data={data} />
      <OnNowCard data={data} />
      <AlsoOffered data={data} />
      <WritingShelf data={data} allHref={writingHref} />
    </div>
  );
}
