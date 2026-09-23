import { defineBlock, type PropsOf } from "../registry";
import { StoreShowcase } from "@elkdonis/commerce/components";
import type { Artwork, Store } from "@elkdonis/commerce/types";

// ============================================================================
// A person's DEFAULT store panel, on somebody else's page.
//
// This is the floor, not the feature: the plain listing shown when someone
// has switched their store section on (`users.profile_sections.store`) but
// has not designed anything for this org. It is StoreShowcase, unchanged —
// the same relationship every profile-* block has with its rendering half —
// wired through as a block so an org's Puck page can place it like any other.
//
// A person who WANTS to design their panel gets a Puck document of their own
// (`user_pages`, key `store:N`) instead, edited on its own surface and
// rendered by a restricted store catalogue — a handful of display blocks
// (profile-gallery, card-grid, figure…), never this one. This block is what
// shows before that exists, or if it never does: most people will never open
// an editor, and this is what "the section is on" means for them.
//
// ── Why this reads the artwork table and profile-gallery does not ─────────
//
// This IS the for-sale question. `getStoreShowcaseForUser` returns null for
// anyone without an active, approved store, and the loader must not fall back
// to anything when it does — a store panel that quietly shows portfolio
// pictures instead of a store is not the store, and would be a confusing
// thing to publish under a heading that still says "Store".
// ============================================================================

const props = [
  {
    name: "artist",
    kind: "string",
    binds: "user",
    label: "Whose store",
    description:
      "Leave empty on a profile page — it uses whoever the page is about.",
  },
  {
    name: "heading",
    kind: "string",
    label: "Heading",
    default: "Store",
    inlineEditable: true,
  },
  {
    name: "blurb",
    kind: "text",
    label: "Line under the heading",
    description: "Leave empty for the standard line about where the sale happens.",
    default: "",
    inlineEditable: true,
  },
  {
    name: "density",
    kind: "select",
    label: "Card size",
    default: "normal",
    options: [
      { value: "tight", label: "Tight — more, smaller" },
      { value: "normal", label: "Normal" },
      { value: "loose", label: "Loose — fewer, larger" },
    ],
  },
  {
    name: "limit",
    kind: "number",
    label: "How many pieces",
    default: 6,
    min: 2,
    max: 24,
  },
] as const;

export type ProfileStoreProps = PropsOf<typeof props> & {
  /** Null when the person has no active store, or the section is off. */
  store: Store | null;
  artworks: Artwork[];
  marketplaceUrl: string;
  /** The org this is embedded on, so the marketplace can send them back. */
  from?: string | null;
};

export function ProfileStore({
  // Questions for the loader, not display settings — they stop here rather
  // than reaching the DOM as stray attributes.
  artist: _artist,
  limit: _limit,
  heading,
  blurb,
  density,
  store,
  artworks,
  marketplaceUrl,
  from,
}: ProfileStoreProps) {
  // No store, or the section is off: draw nothing. A heading over an empty
  // grid reads as broken; absence reads as "no store here", which is true.
  if (!store) return null;

  return (
    <StoreShowcase
      store={store}
      artworks={artworks}
      marketplaceUrl={marketplaceUrl}
      from={from}
      heading={heading}
      // `|| undefined`, not `?? undefined`: coerceProps fills an unset text
      // prop with "", and `??` would let that empty string suppress
      // StoreShowcase's own default sentence.
      blurb={blurb || undefined}
      density={density as "tight" | "normal" | "loose"}
    />
  );
}

export const profileStore = defineBlock(
  {
    id: "profile-store",
    category: "listings",
    label: "Their store (default)",
    description:
      "A plain listing of what this person has for sale. What shows when nobody has designed a store panel — see profile-gallery for pictures with no sale attached.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  ProfileStore,
  () => ({
    heading: "Store",
    density: "normal" as const,
    marketplaceUrl: "",
    store: { id: "sample", slug: "sample-studio", status: "active" } as unknown as Store,
    artworks: [
      { id: "s1", title: "Nightjar", slug: "nightjar", status: "available" },
      { id: "s2", title: "Three Vessels", slug: "three-vessels", status: "reserved" },
    ] as unknown as Artwork[],
  })
);
