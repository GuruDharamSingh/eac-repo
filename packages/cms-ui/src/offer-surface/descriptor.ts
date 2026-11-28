import type { SurfaceDescriptor } from "../surface/types";
import type { SurfaceOffer } from "./types";

// ============================================================================
// Offer layers as surface descriptors.
//
// The handoff's layers are carried as `custom` descriptors with key "offer"
// (the shape the shared forms already use): the host registers one connector,
// `connectors.custom.offer`, and the provider's stack, Esc, crumb, scrim and
// ?surface= handling apply unchanged. Plain data only, so a descriptor can sit
// in a URL: url.ts serialises the layer, the key and the flow.
// ============================================================================

// ----------------------------------------------------------------------------
// THE STACK RULE (lane S, 2026-11-27; Justin's decision 20). One rule for every
// way a layer is finished or dismissed. The helpers are in stack.tsx.
//
//   crumb ("‹ Previous title")   pops ONE layer.
//   Esc                          pops ONE layer (the provider's cancel handler).
//   ✕ and the dimmed page        close the WHOLE stack (packet core rule 2).
//   a finished flow              the `done` layer's "Done" returns to the layer
//                                the flow STARTED FROM:
//                                series -> session -> RSVP -> done: "Done" lands
//                                on the SESSION, not on the page and not on the
//                                series. The origin is the nearest layer below
//                                that is not a step (steps are RSVP, order, pay,
//                                subscribe, follow, join, done: see STEP_LAYERS).
//                                A flow that began at the first layer
//                                (evt-offer -> rsvp -> done) returns to that offer
//                                (DONE_RETURNS_TO_ROOT_OFFER = false closes to the
//                                page instead, the packet's "Done closes").
//   "Reply in the talk"          (a member's profile) returns to the nearest talk
//                                layer below it, else pops one.
//   join                         the quick sign-up is a step layer. The layer the visitor pressed
//                                (RSVP, follow, subscribe, post) pushes it; on success it pops ITSELF
//                                and that layer completes the action without asking again. Crumb and
//                                Esc pop it with nothing done.
//   a stack of one               (a shared link, the return from Stripe, a
//                                hover-card Follow) has no origin: Done closes.
//
// Several layers are popped by stack.tsx `popTo`, built on the provider's public
// `pop` (the provider has no popTo): one pop per commit, before paint.
// `OfferCtx.from` records the origin's depth on the `done` push.
// ----------------------------------------------------------------------------

/** Done from a flow that began at the first layer: true returns to that offer, false closes to the page. */
export const DONE_RETURNS_TO_ROOT_OFFER = true;

export const OFFER_KEY = "offer";

export type OfferLayerId =
  | "evt-offer"
  | "evt-rsvp"
  | "svc-offer"
  | "art-offer"
  | "art-order"
  | "pay"
  | "done"
  | "pf-owner"
  | "pf-guest"
  | "follow"
  | "share"
  | "wr-read"
  | "talk"
  | "ser-offer"
  | "ser-sub"
  | "ser-session"
  | "pf-member"
  | "join";

export const OFFER_LAYERS: readonly OfferLayerId[] = [
  "evt-offer",
  "evt-rsvp",
  "svc-offer",
  "art-offer",
  "art-order",
  "pay",
  "done",
  "pf-owner",
  "pf-guest",
  "follow",
  "share",
  "wr-read",
  "talk",
  "ser-offer",
  "ser-sub",
  "ser-session",
  "pf-member",
  "join",
];

/** What a transaction layer is paying for or finishing. */
export type OfferFlow = "svc" | "evt" | "art" | "ser" | "fol";

export const OFFER_FLOWS: readonly OfferFlow[] = ["svc", "evt", "art", "ser", "fol"];

/** What the visitor started when the `join` layer was pushed: picks the line it says, and what completes after. */
export type JoinThen = "rsvp" | "follow" | "sub" | "post";

/** State handed from layer to layer. Lives in memory; only `flow` reaches the URL. */
export interface OfferCtx {
  flow?: OfferFlow;
  slotId?: string;
  amountMinor?: number;
  delivery?: "ship" | "collect";
  address?: string;
  /** The featured offer, opened from the profile: the head button reads "Its page". */
  featured?: boolean;
  /** Name of an org an RSVP also made the visitor a follower of. */
  follows?: string;
  /** Depth (1-based) of the layer the flow started from; set on the `done` push. Done returns there (rule above). */
  from?: number;
  /** `join` only: the action the visitor started (the layer below completes it once they have an account). */
  then?: JoinThen;
}

export interface OfferProps {
  layer: OfferLayerId;
  /** Offer key (`thread:<id>` / `artwork:<id>`), or a profile id for pf-* and follow. */
  key?: string;
  ctx?: OfferCtx;
}

export type OfferDescriptor = Extract<SurfaceDescriptor, { type: "custom" }>;

export function offerDescriptor(layer: OfferLayerId, key?: string, ctx?: OfferCtx): OfferDescriptor {
  const props: OfferProps = { layer, key, ctx };
  return { type: "custom", key: OFFER_KEY, kind: "neutral", size: "compact", props: props as unknown as Record<string, unknown> };
}

export function offerProps(d: OfferDescriptor): OfferProps | null {
  const p = d.props as Partial<OfferProps> | undefined;
  if (!p || !p.layer || !OFFER_LAYERS.includes(p.layer)) return null;
  return { layer: p.layer, key: p.key, ctx: p.ctx };
}

/** The first layer an offer opens at. */
export function layerFor(offer: Pick<SurfaceOffer, "kind">): OfferLayerId | null {
  switch (offer.kind) {
    case "event":
      return "evt-offer";
    case "service":
      return "svc-offer";
    case "artwork":
      return "art-offer";
    case "series":
      return "ser-offer";
    case "writing":
      return "wr-read";
    default:
      return null;
  }
}

/**
 * `?surface=` value for a layer: `offer:<layer>:<encodeURIComponent(key)>[:<flow>]`. Every OfferLayerId
 * round-trips through url.ts. A key may hold a colon (`thread:<id>`): it is written encoded, and the
 * parser also accepts it written plain (the address bar decodes once before the parser sees it).
 */
export function offerSurfaceValue(layer: OfferLayerId, key: string, flow?: OfferFlow): string {
  return `offer:${layer}:${encodeURIComponent(key)}${flow ? `:${flow}` : ""}`;
}
