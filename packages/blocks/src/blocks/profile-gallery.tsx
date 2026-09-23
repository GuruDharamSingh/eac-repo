import { defineBlock, type PropsOf } from "../registry";
import type { RowValue } from "../types";
import { PictureWall, WALL_PROPS, type PictureWallProps } from "./picture-wall";

// ============================================================================
// One of a person's galleries, on somebody else's page.
//
// The rendering half is PictureWall itself, unchanged, and its presentation
// props are literally the same array (WALL_PROPS) — so the two blocks cannot
// drift about what a caption looks like. Same relationship profile-feed has
// with ThreadFeed.
//
// ── Why this is not a store block ──────────────────────────────────────────
//
// "Show my work" and "sell my work" are different questions, and this answers
// only the first. A gallery item carries its own picture URL — migration 146
// made `artworkId` optional beside a url/title SNAPSHOT, precisely so that a
// component which knows nothing about artworks can still draw one. Nothing
// here reads the artwork table, needs a store, or cares about a piece's sale
// status, which is what lets somebody with no marketplace account at all show
// their work. What is FOR SALE is a separate block asking a separate question.
//
// ── Where it may appear is the GALLERY's business ──────────────────────────
//
// Not a property of the pictures and not a setting on this block: a gallery
// names the sites it must not appear on (`hidden_on`), and the loader is
// handed the asking site. An author dropping this block cannot override that.
// ============================================================================

const DATA_PROPS = [
  {
    name: "artist",
    kind: "string",
    binds: "user",
    label: "Whose work",
    description:
      "Leave empty on a profile page — it uses whoever the page is about.",
  },
  {
    name: "gallery",
    kind: "string",
    binds: "gallery",
    label: "Which gallery",
    description: "Leave empty for the one belonging to this page, or their first.",
  },
  {
    name: "heading",
    kind: "string",
    label: "Heading",
    description: "Leave empty to use the gallery's own title.",
    default: "",
    inlineEditable: true,
  },
  {
    name: "limit",
    kind: "number",
    label: "How many pictures",
    default: 24,
    min: 1,
    max: 200,
  },
  {
    name: "link",
    kind: "select",
    label: "Where a picture goes",
    default: "nowhere",
    options: [
      { value: "nowhere", label: "Nowhere — pictures only" },
      // The picture's own address. The cheapest useful link there is: no
      // lookup, no second page to maintain, and it is what someone expects
      // from clicking a thumbnail.
      { value: "image", label: "The full-size picture" },
      { value: "gallery", label: "The gallery's own page" },
      // The ONLY option that reads the artwork table, and only for pieces
      // that are actually listed. Everything else stays a plain picture.
      { value: "marketplace", label: "The marketplace, for work that is for sale" },
    ],
  },
] as const;

const props = [...DATA_PROPS, ...WALL_PROPS] as const;

export type ProfileGalleryProps = PropsOf<typeof props> & {
  /** Already in PictureWall's row shape — see loadProfileGallery. */
  pictures: RowValue[];
  /** The gallery's own title, used when `heading` is blank. */
  galleryTitle?: string | null;
};

export function ProfileGallery({
  // Questions for the loader, not display settings: they stop here rather
  // than reaching PictureWall and from there the DOM.
  artist: _artist,
  gallery: _gallery,
  limit: _limit,
  link: _link,
  heading,
  galleryTitle,
  pictures,
  ...wall
}: ProfileGalleryProps) {
  // Nothing to show is nothing to draw. PictureWall already returns null for
  // an empty list; the heading is the part that would otherwise be left
  // standing over a gap, reading as a broken page rather than an empty one.
  if (!pictures.length) return null;
  const title = (typeof heading === "string" && heading.trim()) || galleryTitle || null;

  return (
    <>
      {title ? <h2 className="blk blk-heading-title blk-wall-title">{title}</h2> : null}
      <PictureWall {...(wall as PictureWallProps)} pictures={pictures} />
    </>
  );
}

export const profileGallery = defineBlock(
  {
    id: "profile-gallery",
    category: "listings",
    label: "Their work",
    description:
      "Pictures from one of this person's galleries. Shows the work; says nothing about whether it is for sale.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  ProfileGallery,
  () => ({
    heading: "",
    limit: 24,
    link: "nowhere" as const,
    galleryTitle: "Recent work",
    pictures: [
      { src: "/api/media/sample/one.jpg", caption: "Nightjar", alt: "A dark bird, in oils" },
      { src: "/api/media/sample/two.jpg", caption: "Three Vessels", alt: "Three clay forms" },
      { src: "/api/media/sample/three.jpg", caption: "Low Winter Sun", alt: "A pale horizon" },
    ],
  })
);
