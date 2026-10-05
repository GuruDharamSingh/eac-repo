import { defineBlock, type PropsOf } from "../registry";
import { sized, srcSet } from "../media";
import type { OfferingRecord } from "../person-context";

// ============================================================================
// One offering, large: a picture, a title, a short pitch and one button.
//
// For a featured page ("Single spotlight", 2026-09-26): a work for sale, a
// workshop, an event, a service, a piece of writing or a gallery, chosen by
// reference. Same bound-or-typed rule as feature-card: `record` stores only
// `artwork:<id>`, `thread:<id>`, `writing:<id>` or `gallery:<id>`; the host's
// resolver returns the record as `bound`, and anything typed here wins over
// it. The button's words default to the record's own (Buy, Book, RSVP, Read,
// View), so a spotlight works with only a record chosen.
//
// Styled on --blk-* tokens; the button is link-button's filled button.
// ============================================================================

const props = [
  {
    name: "record",
    kind: "string",
    binds: "record",
    label: "Offering (live)",
    description:
      "One of your works, workshops, events, services, writing or galleries. The spotlight shows its current picture, title and link wherever you left a field empty.",
    default: "",
  },
  { name: "kicker", kind: "string", label: "Small line above the title", description: "e.g. New work, This month, Book now." },
  { name: "title", kind: "string", label: "Title", description: "Leave empty to use the offering's own." },
  { name: "pitch", kind: "text", label: "Short pitch", description: "A sentence or two on why it is worth a look." },
  { name: "image", kind: "image", label: "Picture" },
  { name: "buttonLabel", kind: "string", label: "Button words", description: "Leave empty for Buy, Book, RSVP, Read or View." },
  { name: "href", kind: "url", label: "Button goes to", description: "Leave empty to use the offering's own page." },
  {
    name: "picture",
    kind: "select",
    label: "Picture",
    default: "start",
    options: [
      { value: "start", label: "Left of the words" },
      { value: "end", label: "Right of the words" },
      { value: "top", label: "Above the words" },
    ],
  },
] as const;

export type OfferingSpotlightProps = PropsOf<typeof props> & {
  /** From the host's resolver, when `record` names something it can read. */
  bound?: OfferingRecord | null;
  puck?: { isEditing?: boolean };
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A same-site path or an http(s)/mailto address; anything else is not a link. */
function safeHref(v: string): string {
  if (v.startsWith("/")) return v.startsWith("//") ? "" : v;
  return /^(https?:\/\/|mailto:)/i.test(v) ? v : "";
}

export function OfferingSpotlight({
  record,
  kicker,
  title,
  pitch,
  image,
  buttonLabel,
  href,
  picture = "start",
  bound,
  puck,
}: OfferingSpotlightProps) {
  const b = bound ?? null;
  const editing = Boolean(puck?.isEditing);
  const shownTitle = text(title) || text(b?.title);
  const shownPitch = text(pitch) || text(b?.excerpt);
  const shownImage = text(image) || text(b?.image);
  const shownKicker = text(kicker) || text(b?.kicker) || text(b?.kind);
  const shownMeta = text(b?.meta);
  const link = safeHref(text(href) || text(b?.href));
  const label = text(buttonLabel) || text(b?.action) || "View";

  if (!shownTitle && !shownImage) {
    if (!editing) return null;
    return (
      <section className="blk blk-spotlight" data-picture={picture}>
        <p className="blk-spotlight-empty">
          {text(record)
            ? "The offering this spotlight was filled from is no longer available. Choose another, or type the words in."
            : "Choose one of your offerings in the fields panel, or type a title and pick a picture."}
        </p>
      </section>
    );
  }

  return (
    <section className="blk blk-spotlight" data-picture={shownImage ? picture : "none"}>
      {shownImage ? (
        <div className="blk-spotlight-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="blk-spotlight-img"
            src={sized(shownImage, 1024)}
            srcSet={srcSet(shownImage)}
            sizes="(max-width: 760px) 100vw, 60vw"
            alt={shownTitle}
          />
        </div>
      ) : null}
      <div className="blk-spotlight-words">
        {shownKicker ? <p className="blk-spotlight-kicker">{shownKicker}</p> : null}
        {shownTitle ? <h2 className="blk-spotlight-title">{shownTitle}</h2> : null}
        {shownMeta ? <p className="blk-spotlight-meta">{shownMeta}</p> : null}
        {shownPitch ? <p className="blk-spotlight-pitch">{shownPitch}</p> : null}
        {link ? (
          <p className="blk-spotlight-action">
            {/* In the editor a link would navigate the canvas away. */}
            <a className="blk-cta-link" data-tone="filled" href={editing ? undefined : link}>
              {label}
            </a>
          </p>
        ) : null}
        {editing && b ? (
          <span className="blk-card-live" title="Filled from an offering; typed fields override it">
            Live · {text(b.kind) || "offering"}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export const offeringSpotlight = defineBlock(
  {
    id: "offering-spotlight",
    category: "content",
    label: "Spotlight",
    description:
      "One offering, large: a picture, a title, a short pitch and one button — filled live from a work, workshop, event, service, piece of writing or gallery.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  OfferingSpotlight,
  () => ({
    record: "",
    kicker: "Workshop",
    title: "Intaglio in a weekend",
    pitch: "Two days in the print studio: plate, ground, bite and pull. Materials included; six places.",
    image: "",
    buttonLabel: "",
    href: "",
    picture: "start" as const,
    bound: { ref: "thread:sample", kind: "workshop", title: "Intaglio in a weekend", action: "Book", href: "#" },
  })
);
