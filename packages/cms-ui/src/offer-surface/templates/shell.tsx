"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { SurfaceIcon, type SurfaceIconKind } from "../icons";
import { useOfferEnv } from "../env";
import { layerFor, offerDescriptor } from "../descriptor";
import { useOpenOffer } from "../page";
import { hasEnded } from "../format";
import { useNowMs } from "../ended";
import type { SurfaceOffer } from "../types";
import type { TemplateData, TemplateId } from "./types";

// ============================================================================
// The frame every offer-page template draws in (owner: lane D).
//
//   <TemplateShell data={data} template="event">…the template's main…</TemplateShell>
//
// Desktop (>= 900px): one screen, no page scroll: top bar / main / gateway.
// Long content scrolls inside its own pane (class "ost-scroll").
// Phone (< 640px): the page scrolls, at most two screens tall.
//
// Top bar: site name, PROFILE, + FOLLOW (packet frames 3a / 2m / 4b).
// Gateway: "Also offered", one small door per offer. Faces whose layer is not
// built yet (series) are drawn inert; Profile lives in the top bar only.
// ============================================================================

const KIND_ICON: Record<SurfaceOffer["kind"], SurfaceIconKind> = { event: "evt", service: "svc", series: "ser", artwork: "art", writing: "wr" };

export interface TemplateShellProps {
  data: TemplateData;
  template: TemplateId;
  /** Where "Profile" goes. Default "/profile". */
  profileHref?: string;
  /** Replace the top bar (gazette's masthead). */
  top?: React.ReactNode;
  /** Show the gateway strip. Default true. */
  gateway?: boolean;
  children: React.ReactNode;
}

export function TemplateShell({ data, template, profileHref = "/profile", top, gateway = true, children }: TemplateShellProps) {
  return (
    <div className="ost-page" data-template={template}>
      {top ?? <TemplateTopBar data={data} profileHref={profileHref} active={template === "profile"} />}
      <main className="ost-main">{children}</main>
      {gateway && <OfferGateway data={data} />}
    </div>
  );
}

/** Site name, Profile, + Follow. */
export function TemplateTopBar({ data, profileHref, active }: { data: TemplateData; profileHref: string; active?: boolean }) {
  const { open } = useSurface();
  const env = useOfferEnv();
  const following = env.isFollowing(data.owner.id);
  return (
    <nav className="ost-top" aria-label="Site">
      <span className="ost-sitename">{data.site.name}</span>
      <span className="ost-top-links">
        <a className={`ost-toplink${active ? " is-active" : ""}`} href={profileHref} aria-current={active ? "page" : undefined}>
          Profile
        </a>
        <button
          type="button"
          className={`ost-toplink is-follow${following ? " is-on" : ""}`}
          onClick={(e) => open(following ? offerDescriptor("pf-owner", data.owner.id) : offerDescriptor("follow", data.owner.id, { flow: "fol" }), e.currentTarget)}
        >
          {following ? "✓ Following" : "+ Follow"}
        </button>
      </span>
    </nav>
  );
}

function GateInner({ offer }: { offer: SurfaceOffer }) {
  const env = useOfferEnv();
  const now = useNowMs();
  const past = now != null && hasEnded(offer, now);
  return (
    <>
      <span className="osf-kbox ost-gate-box" style={{ ["--osf-kc" as string]: `var(--os-kind-${offer.kind})` }}>
        <SurfaceIcon kind={KIND_ICON[offer.kind]} set={env.data.look.icons} size={13} />
      </span>
      <span className="ost-gate-text">
        <span className="ost-gate-kind">{past ? `${offer.kind} · Past` : offer.kind}</span>
        <span className="ost-gate-title">{offer.title}</span>
      </span>
      <span className="ost-gate-plus" aria-hidden>
        +
      </span>
    </>
  );
}

/** The small door to everything else the site offers: each face opens its surface here. */
export function OfferGateway({ data, label = "Also offered" }: { data: TemplateData; label?: string }) {
  const openOffer = useOpenOffer();
  const list = data.offers.filter((o) => o.key !== data.featured?.key);
  if (list.length === 0) return null;
  return (
    <aside className="ost-gate" aria-label={label}>
      <span className="ost-gate-label">{label}</span>
      <div className="ost-gate-row">
        {list.map((o) =>
          layerFor(o) ? (
            <button key={o.key} type="button" className="ost-gate-face" onClick={(e) => openOffer(o, e.currentTarget)}>
              <GateInner offer={o} />
            </button>
          ) : (
            // Only reached for a kind with no layer; never a link.
            <div key={o.key} className="ost-gate-face is-inert" aria-disabled="true">
              <GateInner offer={o} />
            </div>
          )
        )}
      </div>
    </aside>
  );
}
