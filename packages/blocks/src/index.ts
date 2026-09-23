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
export { WALL_PROPS } from "./blocks/picture-wall";

import { heroBanner } from "./blocks/hero-banner";
import { sectionBanner } from "./blocks/section-banner";
import { cycleBadge } from "./blocks/cycle-badge";
import { threadFeed } from "./blocks/thread-feed";
import { splitRow } from "./blocks/split-row";
import { grid } from "./blocks/grid";
import { storeFrame } from "./blocks/store-frame";
import { storeHeader } from "./blocks/store-header";
import { storeShelf } from "./blocks/store-shelf";
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
import { profileGallery } from "./blocks/profile-gallery";
import { profileStore } from "./blocks/profile-store";
import { galleryGrid } from "./blocks/gallery-grid";
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
  grid,
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
  profileGallery,
  profileStore,
  profileRecord,
  galleryGrid,
  // A designed store section: a box, a header with an effect, a shelf.
  storeFrame,
  storeHeader,
  storeShelf,
] as unknown as Block<never>[];

export const sharedCatalogue = createCatalogue(SHARED_BLOCKS);

/**
 * The STORE PANEL's own catalogue — a small, fixed set for a small, fixed
 * space.
 *
 * Every store panel renders inside a bounded square section of an org's own
 * page (the editor's Puck `viewports` sets the canvas to that size), so the
 * palette is restricted to blocks suited to a handful of pieces rather than
 * everything a full page might use — no hero banners, no thread feeds, no
 * contact forms. Restricting the LIST is simpler and safer than restricting
 * what a general-purpose block does inside a small space, and it is the
 * difference between designing a section and designing a page.
 *
 * `profileGallery` and `profileStore` are both here on purpose, as two
 * different answers to "what goes in this panel": a curated gallery someone
 * has arranged by hand, or their live inventory shown automatically. Someone
 * may use either, or both, on different pages of their panel.
 */
export const STORE_PANEL_BLOCKS = [
  storeFrame,
  storeHeader,
  storeShelf,
  sectionHeading,
  grid,
  prose,
  figure,
  pictureWall,
  cardGrid,
  featureCard,
  profileGallery,
  galleryGrid,
  profileStore,
  divider,
  linkButton,
] as unknown as Block<never>[];

export const storePanelCatalogue = createCatalogue(STORE_PANEL_BLOCKS);

// Starting points for a designed store section. Data only — see templates/store.ts.
export { STORE_TEMPLATES, type PageTemplate, type TemplateNode } from "./templates/store";
