"use client";

import * as React from "react";
import { offerProps, type OfferDescriptor } from "./descriptor";
import { ArtworkOffer, ArtworkOrder, EventOffer, ServiceOffer } from "./layers";
import { Done, EventRsvp, Follow, Pay, ProfileLayer, Share } from "./layers-flow";
import { Talk, WrRead } from "./layers-read";
import { SeriesOffer, SeriesSession, SeriesSub } from "./layers-series";
import { MemberProfile } from "./layers-people";
import { Join } from "./layers-join";
import { OfferFrame } from "./OfferFrame";
import { useOfferEnv } from "./env";
import { PaymentCancelledScope } from "./cancelled";

/** Descriptor -> layer. The host registers this as `connectors.custom.offer` (OfferSurfaceRoot does). */
export function OfferLayer({ descriptor }: { descriptor: OfferDescriptor }) {
  const env = useOfferEnv();
  const props = offerProps(descriptor);
  if (props?.layer === "pay") {
    // A shared link carries no slot or delivery choice: start from the offer so the choice is made.
    const o = env.findOffer(props.key);
    const flow = props.ctx?.flow;
    if (flow === "svc" && o?.slots?.length && !props.ctx?.slotId) return <ServiceOffer offerKey={props.key} ctx={props.ctx} />;
    if (flow === "art" && !props.ctx?.delivery) return <ArtworkOffer offerKey={props.key} ctx={props.ctx} />;
  }
  if (!props) {
    return (
      <OfferFrame gk="evt" kicker="Offer" title="Not available">
        <p className="osf-note">This link does not open anything here.</p>
      </OfferFrame>
    );
  }
  switch (props.layer) {
    case "evt-offer":
      return <PaymentCancelledScope><EventOffer offerKey={props.key} ctx={props.ctx} /></PaymentCancelledScope>;
    case "svc-offer":
      return <PaymentCancelledScope><ServiceOffer offerKey={props.key} ctx={props.ctx} /></PaymentCancelledScope>;
    case "art-offer":
      return <PaymentCancelledScope><ArtworkOffer offerKey={props.key} ctx={props.ctx} /></PaymentCancelledScope>;
    case "art-order":
      return <ArtworkOrder props={props} />;
    case "evt-rsvp":
      return <EventRsvp props={props} />;
    case "pay":
      return <Pay props={props} />;
    case "done":
      return <Done props={props} />;
    case "follow":
      return <Follow props={props} />;
    case "share":
      return <Share props={props} />;
    case "pf-owner":
      return <ProfileLayer props={props} />;
    case "pf-guest":
      return <ProfileLayer props={props} guest />;
    case "wr-read":
      return <WrRead props={props} />;
    case "talk":
      return <Talk props={props} />;
    case "ser-offer":
      return <SeriesOffer props={props} />;
    case "ser-sub":
      return <SeriesSub props={props} />;
    case "ser-session":
      return <SeriesSession props={props} />;
    case "pf-member":
      return <MemberProfile props={props} />;
    case "join":
      return <Join props={props} />;
  }
}
