import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { FeedListView, PlacesCatalogueView } from "./views3.client";
import type { MobileFeedRow, MobilePlaceRow } from "./types";

// ============================================================================
// Places catalogue (12) and Feed (15), G5/G6. The words around the data are the owner's (inlineEditable, with
// `prop:` parts); the places and posts are locked and arrive through resolvers (lib/puck/mobile-places.ts).
// EMPTY: 0 tags shows only the "All" chip; no favourites hides the Favourites chip; no rows shows the empty line.
// ============================================================================

const placesProps = [
  { name: "chipAll", kind: "string", label: "Chip: all", default: "All", inlineEditable: true },
  { name: "chipFavourites", kind: "string", label: "Chip: favourites", default: "Favourites", inlineEditable: true },
  { name: "favouriteText", kind: "string", label: "Line on a starred place", default: "A guide favourite", inlineEditable: true },
  { name: "emptyText", kind: "string", label: "When nothing matches", default: "No places match that yet.", inlineEditable: true },
] as const;

export type MPlacesCatalogueProps = PropsOf<typeof placesProps> & {
  /** From the resolver. Never stored. */
  rows?: MobilePlaceRow[] | null;
  tags?: { tag: string; count: number }[] | null;
  favouriteCount?: number | null;
};

export const mPlacesCatalogue = defineBlock(
  {
    id: "m-places-catalogue",
    category: "content",
    label: "Phone places catalogue",
    description: "Filter chips (All, Favourites, then each tag in use) and the places as catalogue rows.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props: placesProps,
    parts: {
      root: { label: "Places catalogue", sel: "> .blk-mpc" },
      chipAll: { label: "Chip: all", sel: ".blk-mpc-chip-all", prop: "chipAll" },
      chipFavourites: { label: "Chip: favourites", sel: ".blk-mpc-chip-fav", prop: "chipFavourites" },
      row: { label: "Place row", sel: ".blk-mpc-row" },
      empty: { label: "Empty line", sel: ".blk-mpc-empty", prop: "emptyText" },
    },
  },
  (p: MPlacesCatalogueProps) => <PlacesCatalogueView {...p} />,
  () => ({
    chipAll: "All", chipFavourites: "Favourites", favouriteText: "A guide favourite", emptyText: "No places match that yet.",
    favouriteCount: 1,
    tags: [{ tag: "Gallery", count: 2 }, { tag: "Cafe", count: 1 }],
    rows: [
      { id: "p1", slug: "sample", name: "A gallery", kind: "Gallery", area: "12 rue Example", tags: ["Gallery"], favourite: true, img: null },
      { id: "p2", slug: "sample-2", name: "A corner cafe", kind: "Cafe", area: "3 place Example", tags: ["Cafe"], favourite: false, img: null },
    ],
  })
);

const feedProps = [
  { name: "postLabel", kind: "string", label: "Kicker on a post", default: "Post", inlineEditable: true },
  { name: "linkLabel", kind: "string", label: "Kicker on a link", default: "Link", inlineEditable: true },
  { name: "commentsWord", kind: "string", label: "Word after the comment count", default: "comments", inlineEditable: true },
  { name: "emptyText", kind: "string", label: "When there are no posts", default: "Nothing has been shared yet. The guides will post here.", inlineEditable: true },
] as const;

export type MFeedListProps = PropsOf<typeof feedProps> & {
  /** From the resolver. Never stored. */
  rows?: MobileFeedRow[] | null;
};

export const mFeedList = defineBlock(
  {
    id: "m-feed-list",
    category: "content",
    label: "Phone feed list",
    description: "The guides' posts and links as catalogue rows. Tapping one opens the post preview.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props: feedProps,
    parts: {
      root: { label: "Feed list", sel: "> .blk-mfl" },
      row: { label: "Post row", sel: ".blk-mfl-row" },
      empty: { label: "Empty line", sel: ".blk-mfl-empty", prop: "emptyText" },
    },
  },
  (p: MFeedListProps) => <FeedListView {...p} />,
  () => ({
    postLabel: "Post", linkLabel: "Link", commentsWord: "comments", emptyText: "Nothing has been shared yet. The guides will post here.",
    rows: [
      { id: "f1", title: "A new route through the passages", kind: "post" as const, host: null, author: "Dana", initial: "D", whenLabel: "2 h ago", replyCount: 3 },
      { id: "f2", title: "An exhibition worth the detour", kind: "link" as const, host: "example.org", author: "Sam", initial: "S", whenLabel: "3 days ago", replyCount: 0 },
    ],
  })
);
