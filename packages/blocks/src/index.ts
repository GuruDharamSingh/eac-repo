// ============================================================================
// @elkdonis/blocks — page blocks for public org sites.
//
// One catalogue of presentational React components, declared as data so the
// same definition can drive a Silex trait panel, a props table, or a
// drag-and-drop editor, without any of them re-describing the props by hand.
//
// Client-safe: nothing reachable from this entry point imports @elkdonis/db.
// Blocks that need a database read get their fetching half from
// "@elkdonis/blocks/server".
//
// Import the stylesheet once, per app:
//     import "@elkdonis/blocks/blocks.css";
// ============================================================================

export type {
  Block,
  RowValue,
  BlockCategory,
  BlockDef,
  PropDef,
  PropKind,
  PropValue,
  SelectOption,
} from "./types";

export { Region } from "./slot";
export { Paragraphs, toParagraphs } from "./text";
export type { RegionProps, SlotRenderer, SlotValue } from "./slot";
export { defineBlock, createCatalogue, type Catalogue, type PropsOf } from "./registry";
export { coerceProps, propsFromAttributes, type RawProps } from "./coerce";
export {
  toSilexTraits,
  toPuckFields,
  toDefaultProps,
  slotNames,
  type SilexTrait,
  type PuckField,
} from "./editor";

export * from "./blocks";

import { heroBanner } from "./blocks/hero-banner";
import { sectionBanner } from "./blocks/section-banner";
import { cycleBadge } from "./blocks/cycle-badge";
import { threadFeed } from "./blocks/thread-feed";
import { splitRow } from "./blocks/split-row";
import { prose } from "./blocks/prose";
import { sectionHeading } from "./blocks/section-heading";
import { figure } from "./blocks/figure";
import { textImage } from "./blocks/text-image";
import { flowColumn } from "./blocks/flow-column";
import { quote } from "./blocks/quote";
import { faq } from "./blocks/faq";
import { video } from "./blocks/video";
import { entryList } from "./blocks/entry-list";
import { pictureWall } from "./blocks/picture-wall";
import { contactForm } from "./blocks/contact-form";
import { divider } from "./blocks/divider";
import { cardGrid } from "./blocks/card-grid";
import { featureCard } from "./blocks/feature-card";
import { linkButton } from "./blocks/link-button";
import { profileFeed } from "./blocks/profile-feed";
import { profileGalleries } from "./blocks/profile-galleries";
import { profileRecord } from "./blocks/profile-record";
import { createCatalogue } from "./registry";
import type { Block } from "./types";

/**
 * Everything this package ships.
 *
 * An app is free to build its own catalogue instead —
 * `createCatalogue([...SHARED_BLOCKS, ...myOrgBlocks])` — which is how a
 * supported-tier site gets blocks written just for it without forking the
 * shared set. Availability is a host fact, the same way `hubCards(caps)`
 * treats it.
 */
export const SHARED_BLOCKS = [
  heroBanner,
  sectionBanner,
  cycleBadge,
  threadFeed,
  // Layout
  splitRow,
  flowColumn,
  cardGrid,
  divider,
  // Headers
  sectionHeading,
  // Content
  prose,
  figure,
  textImage,
  quote,
  faq,
  video,
  featureCard,
  // Listings
  entryList,
  pictureWall,
  // Actions
  linkButton,
  contactForm,
  // A person, rather than an organisation. See profile-feed for why these are
  // three blocks and not six: the store is already `StoreShowcase` in
  // @elkdonis/commerce/components, and a fourth copy of it here would be the
  // duplication this package exists to end.
  profileFeed,
  profileGalleries,
  profileRecord,
] as unknown as Block<never>[];

export const sharedCatalogue = createCatalogue(SHARED_BLOCKS);
