import type { PersonGalleryCard, PersonListItem } from "@elkdonis/cms-ui/profile";
import type { ShelfItem } from "@elkdonis/cms-ui/writing";
import type { Artwork, Store } from "@elkdonis/commerce/types";
import type { CardRecord } from "./blocks/feature-card";

// ============================================================================
// What the person blocks draw from — one person's page, loaded once.
//
// A person page (ArtDirect's `/<slug>` and `/<slug>/featured`, 2026-09-26) is
// a Puck document made of blocks that each show one part of the same person:
// the card, the writing shelf, the memberships. Loading each part per block
// would repeat getPersonPage once per block, so the host loads the whole
// page ONCE (`loadPersonBlockContext`, "@elkdonis/blocks/server") and hands
// it to Puck as `metadata.person`. The resolvers below only pick from it.
//
// That also makes the resolvers the same on both sides: the editor (browser,
// no database) and the published render (server) pass the same metadata, so
// there is no HTTP twin to keep in step and no block API route that could be
// asked about somebody else's page.
//
// Everything here is already filtered for the viewer by the loader:
// drafts and switched-off sections reach the page's owner only.
// ============================================================================

/** The section keys of a person page (services' PERSON_SECTIONS). */
export type PersonBlockSection = "portfolio" | "galleries" | "blog" | "services" | "posts" | "events" | "store";

export interface PersonBlockLink {
  label?: string | null;
  url: string;
}

export interface PersonBlockWork {
  id: string;
  url: string;
  title: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface PersonBlockPerson {
  displayName: string;
  /** Headline on ArtDirect; an org's role title elsewhere. */
  role: string | null;
  /** Plain text; blank lines separate paragraphs. */
  bio: string | null;
  avatarUrl: string | null;
  city: string | null;
  verified: boolean;
  socialLinks: PersonBlockLink[];
}

/** One thing a person offers, for a spotlight or a card: `ref` is what a page stores. */
export interface OfferingRecord extends CardRecord {
  /** `artwork:<id>`, `thread:<id>`, `writing:<id>`, `gallery:<id>`. */
  ref: string;
  /** The button's words when the author leaves them empty: Buy, Book, RSVP, Read, View. */
  action?: string | null;
}

export interface PersonBlockContext {
  userId: string;
  slug: string;
  /** The viewer may edit this person (self or global admin): empty sections show a note. */
  canEdit: boolean;
  person: PersonBlockPerson;
  /** Effective switch per section (users.profile_sections, then defaults). */
  sections: Partial<Record<PersonBlockSection, boolean>>;
  /** Featured work (users.portfolio), with its arranged grid positions. */
  portfolio: PersonBlockWork[];
  galleries: PersonGalleryCard[];
  writing: ShelfItem[];
  /** Where a writing piece reads: `${writingBase}/${slug}`. */
  writingBase: string;
  posts: PersonListItem[];
  events: PersonListItem[];
  /** Bookable services, each linked to its page with a Book button. */
  services: PersonListItem[];
  memberships: { name: string; href: string; role?: string | null }[];
  /** Their active store with listed work, when the store section is on. */
  store: { store: Store; artworks: Artwork[]; marketplaceUrl: string; from: string } | null;
  /** Everything a spotlight or card may be filled from; public records only. */
  offerings: OfferingRecord[];
}

// Structurally page-builder's BlockResolvers; declared here for the reason
// given in server/store-panel.server.tsx (page-builder depends on this package).
type ResolverMap = Record<
  string,
  (props: Record<string, unknown>, metadata: Record<string, unknown>) => Promise<Record<string, unknown>>
>;

function contextOf(metadata: Record<string, unknown>): PersonBlockContext | null {
  const c = metadata.person;
  return c && typeof c === "object" ? (c as PersonBlockContext) : null;
}

/** Off for visitors when the person switched the section off; always on when unknown. */
function isOff(c: PersonBlockContext | null, key: PersonBlockSection): boolean {
  return Boolean(c && c.sections[key] === false);
}

/** The record a stored reference names, from this page's own offerings only. */
export function findOffering(c: PersonBlockContext | null, ref: unknown): OfferingRecord | null {
  if (!c || typeof ref !== "string" || !ref) return null;
  return c.offerings.find((o) => o.ref === ref) ?? null;
}

/**
 * Resolvers for PROFILE_PAGE_BLOCKS and FEATURED_PAGE_BLOCKS.
 *
 * Every resolver returns the same keys whatever the context holds, so a value
 * resolved in the editor (the owner's view, drafts included) is always
 * replaced when the published page resolves for a visitor.
 */
export function personPageResolvers(): ResolverMap {
  return {
    "person-header": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { person: c?.person ?? null };
    },
    "person-card": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { person: c?.person ?? null };
    },
    "person-portfolio": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { works: c?.portfolio ?? [], off: isOff(c, "portfolio"), editable: Boolean(c?.canEdit) };
    },
    "person-galleries": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { galleries: c?.galleries ?? [], off: isOff(c, "galleries"), editable: Boolean(c?.canEdit) };
    },
    "person-writing": async (_props, metadata) => {
      const c = contextOf(metadata);
      return {
        pieces: c?.writing ?? [],
        basePath: c?.writingBase ?? "",
        off: isOff(c, "blog"),
        editable: Boolean(c?.canEdit),
      };
    },
    "person-threads": async (props, metadata) => {
      const c = contextOf(metadata);
      const source: "posts" | "events" | "services" =
        props.source === "events" || props.source === "services" ? props.source : "posts";
      return {
        entries: c?.[source] ?? [],
        off: isOff(c, source),
        editable: Boolean(c?.canEdit),
      };
    },
    "person-memberships": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { orgs: c?.memberships ?? [] };
    },
    "person-store": async (_props, metadata) => {
      const c = contextOf(metadata);
      return { shop: c?.store ?? null, off: isOff(c, "store") };
    },
    "feature-card": async (props, metadata) => ({ bound: findOffering(contextOf(metadata), props.record) }),
    "offering-spotlight": async (props, metadata) => ({ bound: findOffering(contextOf(metadata), props.record) }),
  };
}
