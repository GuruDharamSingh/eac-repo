import { defineBlock, type PropsOf } from "../registry";
import { sized, srcSet } from "../media";

// ============================================================================
// A card: a picture, a small line, a title, a few words, a details line.
//
// Two ways to fill it, as every block that can show a record:
//
//   By hand     every value a visitor sees is a field.
//   From a record ("Filled from") — a post, an event, an artwork. Only a
//               reference is stored ("thread:<id>", "artwork:<id>"); the HOST
//               reads the record at render (its resolver returns `bound`) and
//               the card fills whatever was left blank. A typed value always
//               wins. So a retitled piece or a moved event updates every card
//               showing it, without anyone editing the page.
//
// This package knows no database and no record type: `record` is declared
// `binds: "record"`, and a host that has records supplies the picker and the
// resolver. A host that does not simply never fills `bound`.
//
// Looks ("Treatment"): the network card — the Feed block's card (picture,
// kicker, title, blurb, meta, a kind hairline), and the default for a new
// card — plus the original panel / outlined / plain. A card with nothing to
// show draws nothing, so the editor offers its placeholder and example.
//
// The marker covers the retiring pages' numbered and iconed cards: a short
// string — a number, a glyph — rather than an icon library.
// ============================================================================

/** What a host's resolver fills in from a record. Structural; draw-only fields. */
export interface CardRecord {
  /** "artwork", "event", "post"… — shown to the editor, and as the kicker if none is typed. */
  kind?: string | null;
  title?: string | null;
  href?: string | null;
  image?: string | null;
  kicker?: string | null;
  excerpt?: string | null;
  /** One line of details: a date and place, a price, a medium and year. */
  meta?: string | null;
}

const props = [
  { name: "title", kind: "string", label: "Title", inlineEditable: true },
  { name: "body", kind: "text", label: "Text", inlineEditable: true },
  { name: "image", kind: "image", label: "Picture" },
  {
    name: "kicker",
    kind: "string",
    label: "Small line above the title",
    description: "e.g. Workshop, New work, Exhibition.",
  },
  {
    name: "meta",
    kind: "string",
    label: "Details line",
    description: "Under the text: a date and place, a price, a medium.",
  },
  {
    name: "marker",
    kind: "string",
    label: "Marker",
    description: "A number or a symbol above the title, e.g. 01 or ✦.",
  },
  {
    name: "href",
    kind: "url",
    label: "Link",
    description: "Makes the whole card a link.",
  },
  {
    name: "record",
    kind: "string",
    binds: "record",
    label: "Filled from (live)",
    description:
      "Optional. A post, event or artwork: the card shows its current title, picture and details wherever you left a field empty.",
    default: "",
  },
  {
    name: "tone",
    kind: "select",
    label: "Treatment",
    default: "feed",
    options: [
      { value: "feed", label: "Network card" },
      { value: "panel", label: "On a panel" },
      { value: "bordered", label: "Outlined" },
      { value: "plain", label: "Plain" },
    ],
  },
] as const;

export type FeatureCardProps = PropsOf<typeof props> & {
  /** From the host's resolver, when `record` names something it can read. */
  bound?: CardRecord | null;
  /** Puck's editor context, passed to every block; only `isEditing` is read. */
  puck?: { isEditing?: boolean };
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A same-site path or an http(s)/mailto address; anything else is not a link. */
function safeHref(v: string): string {
  if (v.startsWith("/")) return v.startsWith("//") ? "" : v;
  return /^(https?:\/\/|mailto:)/i.test(v) ? v : "";
}

export function FeatureCard({
  title,
  body,
  image,
  kicker,
  meta,
  marker,
  href,
  record,
  // Saved cards from before "Network card" existed carry their own tone; one
  // with none keeps the look it always had.
  tone = "panel",
  bound,
  puck,
}: FeatureCardProps) {
  const b = bound ?? null;
  // Typed first; the record fills only what was left blank.
  const shownTitle = text(title) || text(b?.title);
  const shownBody = text(body) || text(b?.excerpt);
  const shownImage = text(image) || text(b?.image);
  const shownKicker = text(kicker) || text(b?.kicker) || text(b?.kind);
  const shownMeta = text(meta) || text(b?.meta);
  const link = safeHref(text(href) || text(b?.href));
  const editing = Boolean(puck?.isEditing);
  const wantsRecord = text(record) !== "";

  if (!shownTitle && !shownBody && !shownImage) {
    // The editor's placeholder shows for a card that draws nothing — except
    // when a record was chosen and has gone, which the editor should hear about.
    return editing && wantsRecord ? (
      <article className="blk blk-card" data-tone={tone}>
        <p className="blk-card-body">The record this card was filled from is no longer available.</p>
      </article>
    ) : null;
  }

  const inner = (
    <>
      {shownImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="blk-card-cover"
          src={sized(shownImage, 1024)}
          srcSet={srcSet(shownImage)}
          sizes="(max-width: 640px) 100vw, 400px"
          alt=""
          loading="lazy"
        />
      )}
      {/* Decorative: "01" read aloud before every heading is noise, and the
          heading already carries the meaning. */}
      {marker && (
        <span className="blk-card-marker" aria-hidden="true">
          {marker}
        </span>
      )}
      {shownKicker && <span className="blk-card-kicker">{shownKicker}</span>}
      {shownTitle && <h3 className="blk-card-title">{shownTitle}</h3>}
      {shownBody && <p className="blk-card-body">{shownBody}</p>}
      {shownMeta && <p className="blk-card-meta">{shownMeta}</p>}
      {/* Editor only: says the card is live, so nobody wonders where the words came from. */}
      {editing && b ? (
        <span className="blk-card-live" title="Filled from a record; typed fields override it">
          Live · {text(b.kind) || "record"}
        </span>
      ) : null}
    </>
  );

  // A linked card is an <a>; an unlinked one is an <article>. Not a div with a
  // click handler — that is unreachable by keyboard and invisible to a screen
  // reader, and it is the usual way a "clickable card" goes wrong. In the
  // editor a link inside the canvas would navigate the canvas away.
  return link && !editing ? (
    <a className="blk blk-card" data-tone={tone} href={link}>
      {inner}
    </a>
  ) : (
    <article className="blk blk-card" data-tone={tone}>
      {inner}
    </article>
  );
}

export const featureCard = defineBlock(
  {
    id: "feature-card",
    label: "Card",
    category: "content",
    description:
      "A picture, a title, a few words and details — typed, or filled live from a post, event or artwork. Made to sit in a grid.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  FeatureCard,
  () => ({
    image: "",
    kicker: "Workshop",
    marker: "",
    title: "Gathering",
    body: "We meet before dawn, and we keep the hours together.",
    meta: "Saturdays · 6:00 am",
    href: "",
    record: "",
    tone: "feed" as const,
  })
);
