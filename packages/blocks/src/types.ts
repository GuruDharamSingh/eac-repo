// ============================================================================
// What a block IS.
//
// A block is a piece of a public page — a hero, a section banner, a feed of
// threads — expressed once and usable from every surface that wants to place
// one: a hand-written React page, a Silex trait panel, a props table in an
// admin screen, and (if it ever happens) a drag-and-drop editor.
//
// The whole design rests on ONE decision: a block's props are declared as
// DATA, not only as a TypeScript interface. A TS interface disappears at
// runtime, so anything that wants to offer "edit this block's settings" has to
// re-describe the same props by hand — which is exactly how the Silex
// catalogue and the Silex editor drifted apart once already (the catalogue
// declared 12 components while the editor offered 8). One `PropDef[]` read by
// every consumer is the fix.
//
// The types are still generated FROM the data where it matters, so a block
// author writes the props once and gets both.
// ============================================================================

import type { ComponentType } from "react";
import type { SlotValue } from "./slot";

/**
 * The kinds a prop can be.
 *
 * Deliberately small. Every kind here has to survive the round trip through an
 * HTML attribute (`data-limit="3"`), because that is how Silex passes props,
 * and it has to be offerable as a form control. A kind that can only be
 * expressed as arbitrary JSON would break both, so there isn't one.
 *
 *   string   one line of text
 *   text     several lines
 *   number   coerced from its attribute form
 *   boolean  present/absent, or "true"/"false"
 *   select   one of `options`
 *   list     comma-separated, e.g. tags
 *   url      a link target; same storage as string, different control
 *   image    a media URL; same storage as string, different control
 *
 * And TWO deliberate exceptions to the rule above:
 *
 *   slot     a region that holds OTHER BLOCKS.
 *   rows     a repeatable list of STRUCTURED ITEMS — a CV's years and
 *            entries, a wall of pictures, a list of exhibitions.
 *
 * A slot cannot survive an HTML attribute, because it is not a value — it is
 * an area of the page. It is here anyway because without it no block can
 * CONTAIN another, and a page builder whose blocks cannot nest can only ever
 * produce a vertical stack: no two-column split, no section wrapping cards.
 *
 * `rows` is the same kind of exception for the same kind of reason. `list`
 * exists and holds strings, which is enough for tags and no use at all for the
 * shape that dominates an artist's site: a year AND an entry, a picture AND
 * its caption AND where it links. Without `rows` every such page is either
 * hand-written or assembled from dozens of dragged blocks, and a CV with forty
 * entries is forty blocks.
 *
 * Both exceptions are contained rather than special-cased everywhere. Slots
 * are skipped by `coerceProps`, `propsFromAttributes` and `toSilexTraits`,
 * since none of those can express one; on the Silex side the equivalent of a
 * slot is the element's own inner HTML, not a trait — the seam `silexRoot`
 * already marks. Rows are skipped by the two ATTRIBUTE paths for the same
 * reason, but they ARE coerced, because unlike a slot they are a value: they
 * live in the saved page JSON and reach the component as data.
 */
export type PropKind =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "list"
  | "url"
  | "image"
  | "slot"
  | "rows";

/** Maps a declared kind to the type the component actually receives. */
/** One row of a `kind: "rows"` prop — its declared columns, by name. */
export type RowValue = Record<string, string | number | boolean | undefined>;

export type PropValue<K extends PropKind = PropKind> = K extends "rows"
  ? RowValue[]
  : K extends "number"
  ? number
  : K extends "boolean"
    ? boolean
    : K extends "list"
      ? string[]
      : K extends "slot"
        ? // Rendered content OR a drop region. A hand-written page passes JSX
          // straight in; an editor passes a component that draws the zone.
          // Blocks render either through <Region>, so neither shape leaks an
          // editor dependency into the block. See ./slot.
          SlotValue
        : string;

/**
 * The groups a block can belong to.
 *
 * Deliberately a closed list rather than a free string: categories only help if
 * the same kinds of block keep landing in the same place, and a free string
 * gets "Layout", "layouts" and "Structure" within a month.
 */
export type BlockCategory =
  | "layout"      // holds other blocks — splits, sections, grids
  | "headers"     // banners and heroes at the top of a page
  | "content"     // prose, images, quotes
  | "listings"    // feeds, cards, directories — usually data-driven
  | "actions";    // forms, RSVP, sign-up

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * One editable prop.
 *
 * `default` is the value used when nothing is supplied — which is also what an
 * editor shows when a block is first dropped, and what `coerceProps` falls
 * back to when an attribute is missing or unparseable. Blocks should always
 * declare one for anything non-required, so that a half-configured block still
 * renders something rather than a hole.
 */
export interface PropDef {
  name: string;
  kind: PropKind;
  label: string;
  /** Shown as help text next to the control. */
  description?: string;
  default?: string | number | boolean | readonly string[];
  /** Required for `kind: "select"`. */
  options?: readonly SelectOption[];
  /** No default is offered and an editor should mark it. */
  required?: boolean;

  /**
   * For `kind: "number"` — the range the value is allowed to take.
   *
   * Declared rather than left to the component because a number with a real
   * range is a SLIDER, not a text box, and only the declaration knows which is
   * which. A width in percent wants to be dragged; a "how many posts" count
   * wants to be typed. `coerceProps` also clamps to this, so a hand-edited
   * page JSON cannot reach the component with a 4000% image.
   */
  min?: number;
  max?: number;
  step?: number;
  /** Shown beside a number control, e.g. "%". Display only. */
  unit?: string;

  /**
   * This prop is rendered VERBATIM, so an editor may let it be typed directly
   * on the page instead of in a side panel.
   *
   * Opt-in, and it has to be, because of what the feature costs: inside the
   * editor Puck replaces the value with a ReactNode carrying its own editing
   * surface. A component that renders `{title}` is fine. A component that
   * does `body.split(/\n\n/)` — which is how every paragraph in this library
   * is made — gets an object where it expected a string and draws nothing.
   *
   * So: set it where the block renders the value straight into the markup and
   * nowhere else. `PropsOf` widens such a prop to `string | ReactNode` so the
   * compiler stops anyone processing it.
   */
  inlineEditable?: boolean;

  /**
   * For `kind: "rows"` — the columns of one row.
   *
   * Scalar kinds only. A row holding a slot would be a region inside a repeated
   * value, which no editor models and nothing here needs; a row holding rows is
   * a table, and a block that wants one should say so with its own prop.
   */
  fields?: readonly PropDef[];
  /** For `kind: "rows"` — the label on the button that adds one. */
  addLabel?: string;
  /**
   * For `kind: "rows"` — which columns name a row in a collapsed list.
   *
   * Without it an editor has nothing to show but a position, and a wall of
   * twenty pictures becomes "Item #0" through "Item #19" — a list you have to
   * open one by one to find anything in. Joined in order, blanks skipped.
   */
  summary?: readonly string[];

  /**
   * For `kind: "slot"` — the block ids this region will accept.
   *
   * Omitted means anything in the catalogue. Worth setting wherever a layout
   * only makes sense with certain children, so an author is stopped at the
   * drag rather than after saving a page that renders wrong.
   */
  allow?: readonly string[];

  /**
   * For a `string` prop holding a RECORD ID — the kind of record it binds to,
   * e.g. `"artwork"`.
   *
   * The pattern every block that shows a record follows: bound OR typed, never
   * forced. The block keeps its ordinary manual fields (picture, title,
   * caption); this prop, when filled, supplies the values those fields fall
   * back to. So a block works with nothing bound, works fully bound, and an
   * author can bind a record and still retype just its caption for one page.
   * A manual value always wins over a bound one.
   *
   * Only the ID is stored in the page — never a copy of the record — and the
   * record is read again when the page renders, so a retitled or sold piece is
   * right everywhere without anybody editing a page.
   *
   * It is still a plain string to everything else (attribute parsing, Silex
   * traits, coercion). An editor that understands the source offers a picker
   * for it; one that does not shows a text box holding the id.
   */
  binds?: string;

  /**
   * For a `string` prop — what the text IS, so an editor can offer a better
   * control than a text box. `"color"` is a CSS hex colour (`#1a1a1a`); empty
   * means "the theme's own". Still a plain string everywhere else, and the
   * block must validate it before use: a typed value can be anything.
   */
  format?: "color";
}

/**
 * A block's declaration — pure data, importable anywhere.
 *
 * Kept free of the component itself so that a consumer which only needs to
 * LIST blocks (an editor's palette, a validation script, a docs page) can read
 * the catalogue without pulling React components — and their CSS, and their
 * dependencies — into its bundle.
 */
export interface BlockDef {
  /** Stable identity. Appears in stored page JSON, so never rename casually. */
  id: string;
  label: string;
  description: string;
  props: PropDef[];

  /**
   * Whether an untrusted author (any member) may place this block.
   *
   * Carried over from the Silex embed catalogue, where it guards the same
   * thing: everything currently shipping is read-only or already gated at
   * render time, and the flag exists so that adding a privileged block later
   * has to be a deliberate act rather than an oversight.
   */
  memberSafe: boolean;

  /**
   * Which group this block sits in, in an editor's component list.
   *
   * Puck renders its drawer as a vertical list in the sidebar and groups it by
   * category, so without this every block lands in one undifferentiated pile —
   * which is exactly the moment a catalogue stops feeling like a kit and
   * starts feeling like a dump. Silex has the same notion (block categories),
   * so one declaration serves both.
   */
  category?: BlockCategory;

  /**
   * How the block is styled, and therefore where it is safe to place.
   *
   *   tokens    plain CSS driven by custom properties. Portable to ANY app,
   *             including ifac and artdirect, which carry their own
   *             stylesheets and where a Tailwind utility class renders
   *             unstyled.
   *   tailwind  uses Tailwind utilities. Only safe in apps that compile
   *             Tailwind over this package's source.
   *
   * `tokens` is the target for everything. The field exists because the
   * harvest starts mixed — several blocks are being lifted out of Tailwind
   * apps — and a block library that silently renders unstyled on two apps is
   * worse than one that says which blocks are portable.
   */
  styling: "tokens" | "tailwind";

  /**
   * True when this block's component runs in the BROWSER — a form, anything
   * with state or an event handler.
   *
   * Not a style preference. An editor hands every component an ambient context
   * object full of FUNCTIONS (a drop-zone renderer, a drag ref), and a
   * function cannot cross into a client component from a server render: the
   * published page dies with "Functions cannot be passed directly to Client
   * Components". Declaring this is what lets the adapter drop that context
   * before it reaches the block.
   *
   * Such a block also ships as a pair — declaration here, component behind its
   * own "use client" module — because a "use client" file's exports become
   * client references, and `block.def.props` would then be `undefined` on the
   * server. Both halves of that trap have been hit; see ./blocks/contact-form.
   */
  interactive?: boolean;

  /**
   * True when the block cannot render from props alone — it needs a database
   * read. Such a block ships as a pair (see `Block.Component` vs the server
   * wrapper in ./server), and any editor preview must be fed `sample()`
   * rather than left to fetch.
   */
  dataDriven?: boolean;

  /**
   * Which of this block's props describe WHERE something sits, so an editor
   * can offer them as a drag rather than as a dropdown.
   *
   * Still data, and still no editor dependency: the block is saying "this
   * element of mine can be moved, and these three props are its position and
   * size". An editor that understands direct manipulation can wire a gesture
   * to them; one that does not still renders the same props as ordinary
   * fields, and the block itself neither knows nor cares which happened.
   *
   * Without this, an image's position is a select — which is a perfectly
   * correct control and the wrong gesture. Nobody places a picture in a
   * document by choosing from a list.
   */
  manipulate?: {
    /** The `data-drag-target` value on the element that is dragged. */
    target: string;
    /** Prop holding `left | right | above | below`. */
    place?: string;
    /** Prop holding the width, as a percentage. */
    size?: string;
    /** Prop holding how far down the text it starts, in pixels. */
    offset?: string;
  };

  /**
   * The root class of this block's Silex twin, when it has one.
   *
   * This is the seam that makes a free→supported upgrade a migration rather
   * than a rebuild: a published Silex page can be walked, each section matched
   * to a block by this class, and emitted as stored page JSON. The pens
   * already carry the same pointer in the other direction
   * (`"react": "@elkdonis/cms-ui/pens SpotlightGrid"`).
   */
  silexRoot?: string;
}

/**
 * A declaration bound to the component that renders it.
 *
 * `Component` is ALWAYS the presentational half: props in, markup out, no
 * `await`, no database. Data-driven blocks get their fetching half from
 * `@elkdonis/blocks/server`, which is a separate entry point precisely so that
 * importing a block for display never drags `@elkdonis/db` behind it.
 */
export interface Block<P = Record<string, unknown>> {
  def: BlockDef;
  Component: ComponentType<P>;
  /**
   * Representative props, for previewing the block where real data isn't
   * available or isn't wanted — an editor canvas, a palette thumbnail, a
   * screenshot test. Required for data-driven blocks, which have nothing to
   * show without it.
   */
  sample?: () => P;
}
