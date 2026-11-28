// ============================================================================
// @elkdonis/cms-ui/offer-surface: the single-page site's offer surfaces.
//
//   import "@elkdonis/cms-ui/offer-surface.css";
//   import { OfferSurfaceRoot, OfferProfilePage } from "@elkdonis/cms-ui/offer-surface";
//
//   <OfferSurfaceRoot data={siteData} actions={actions} signInHref="/login">
//     <OfferProfilePage data={siteData} />
//   </OfferSurfaceRoot>
//
// Layers ride the shared surface system (SurfaceProvider, ?surface=) as custom
// descriptors, key "offer". See offer.css for the scope and contrast notes.
// ============================================================================

export { OfferSurfaceRoot } from "./OfferSurfaceRoot";
export type { OfferSurfaceRootProps } from "./OfferSurfaceRoot";
export { OfferLayer } from "./OfferLayer";
export { OfferFrame } from "./OfferFrame";
export type { OfferFrameProps, HeadAction, FootButton } from "./OfferFrame";
export { OfferEnvProvider, useOfferEnv } from "./env";
export type { OfferEnv } from "./env";
export {
  OfferProfilePage,
  OfferTopBar,
  OfferProfileHeader,
  OnNowCard,
  AlsoOffered,
  WritingShelf,
  useOpenOffer,
} from "./page";
export { offerDescriptor, offerProps, layerFor, offerSurfaceValue, OFFER_KEY, OFFER_LAYERS, OFFER_FLOWS } from "./descriptor";
export type { OfferLayerId, OfferFlow, OfferCtx, OfferProps, OfferDescriptor } from "./descriptor";
export { SurfaceIcon } from "./icons";
export type { SurfaceIconKind, SurfaceIconSet } from "./icons";
export { fmtMoney } from "./format";
export * from "./types";
export { OFFER_FONTS_HREF } from "./fonts";
