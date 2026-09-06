/**
 * Declarative template bindings.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * A template manifest already declared *what data* a section reads (`cmsFields`)
 * and *what hooks* its HTML exposes (`traits`). The edge between the two — which
 * field fills which hook, and how it is formatted — lived as hand-written regex
 * in a per-template `render.ts`. Three things had to be kept in sync by hand,
 * and they drifted (the workshop manifest still carries a note about a
 * `threads.tags` entry that never existed as a column).
 *
 * A `bindings` map makes that edge data. One engine reads it for every template,
 * so adding a template is a manifest + HTML change with no renderer code, and
 * the three declarations can be cross-checked mechanically (see `validate.ts`).
 *
 * ── Authoring shape (lives in manifest.json) ─────────────────────────────────
 *   "bindings": {
 *     "title":       { "kind": "text", "from": "workshop.title" },
 *     "eyebrowText": { "kind": "text", "from": ["workshop.discipline",
 *                                               "workshop.seriesLabel"],
 *                      "join": " · " },
 *     "priceFull":   { "kind": "text", "from": ["workshop.price",
 *                                               "workshop.currency"],
 *                      "format": "price" },
 *     "startDate":   { "kind": "text", "from": "workshop.scheduledAt",
 *                      "format": "date" },
 *     "ctaHref":     { "kind": "attr", "attr": "href",
 *                      "from": "workshop.registrationUrl",
 *                      "fallback": "#register" },
 *     "schedule":    { "kind": "list", "from": "workshop.sessions",
 *                      "item": { "sessionTitle": { "kind": "text",
 *                                                  "from": "item.title" } } }
 *   }
 *
 * The key is the value of a `data-trait` (or `data-href-trait`) attribute in the
 * section's HTML.
 *
 * ── The split that keeps the manifest readable ───────────────────────────────
 * The manifest declares *wiring*; named formatters hold *domain logic*. Anything
 * conditional or pluralised ("3 sessions", "Register — $48", "Begins in 4 days")
 * belongs in a formatter, not in manifest syntax. That keeps the JSON free of a
 * homegrown expression language.
 */

/** How a resolved value is written into the document. */
export type BindingKind =
  | "text"
  | "html"
  | "attr"
  | "style"
  | "class"
  | "show"
  | "list";

export interface BindingCommon {
  /**
   * Dotted path(s) into the render context, e.g. `"workshop.title"`.
   *
   * With several paths: if `format` is set the resolved values are passed to the
   * formatter as positional arguments (`price`, `currency` → `formatPrice`);
   * otherwise the non-empty ones are joined with `join`.
   */
  from?: string | string[];
  /** Name of a registered formatter. Receives the resolved value(s). */
  format?: string;
  /** Separator used when `from` is a list and no `format` is given. Default `" "`. */
  join?: string;
  /** Wraps the formatted value. `"{}"` is the placeholder, e.g. `"{} spots"`. */
  template?: string;
  /** Used when the resolved + formatted value is empty. */
  fallback?: string;
  /**
   * Drop the host element entirely when the final value is empty. Use for
   * optional lines that would otherwise render as stray punctuation or an
   * empty box.
   */
  omitWhenEmpty?: boolean;
}

export interface TextBinding extends BindingCommon {
  kind: "text";
}

/**
 * Sets innerHTML. Only for fields that are authored rich text (`threads.body`).
 * The engine does not sanitize — the caller's pipeline must, and
 * `@elkdonis/silex-render` runs `sanitizeSilexHtml` after binding for exactly
 * this reason.
 */
export interface HtmlBinding extends BindingCommon {
  kind: "html";
}

export interface AttrBinding extends BindingCommon {
  kind: "attr";
  /** Attribute to set, e.g. `"href"`, `"src"`, `"alt"`, `"datetime"`. */
  attr: string;
}

/** Sets one inline CSS property, merging with any existing `style` attribute. */
export interface StyleBinding extends BindingCommon {
  kind: "style";
  /** CSS property name, e.g. `"background-image"`. */
  prop: string;
}

/** Adds or removes a class according to the truthiness of the resolved value. */
export interface ClassBinding extends BindingCommon {
  kind: "class";
  /** Class toggled on when the value is truthy. */
  class: string;
}

/**
 * Keeps the element only when the value is truthy (or falsy, with `unless`).
 * Replaces the old pattern of shipping `hidden` in the template HTML and
 * stripping it with a regex.
 */
export interface ShowBinding extends BindingCommon {
  kind: "show";
  /**
   * Invert: keep the element only when the value is *falsy*. With `unless`,
   * several `from` paths mean "keep only when they are *all* empty".
   */
  unless?: boolean;
}

/**
 * Repeats markup once per item in a list.
 *
 * The element carrying the trait is the container; its first child element is
 * the item template. That keeps the item's design in the template file — where
 * a designer can see and restyle it — instead of in a TypeScript string
 * builder, which is what `buildScheduleHtml` / `buildGalleryHtml` used to be.
 *
 * Inside `item`, paths are resolved against `{ ...context, item, index }`.
 */
export interface ListBinding extends BindingCommon {
  kind: "list";
  /** Bindings applied to each cloned item. */
  item: BindingMap;
  /** Render at most this many items. */
  limit?: number;
  /** What to do with the container when the list is empty. Default `"remove"`. */
  whenEmpty?: "remove" | "keep";
  /** Class added to the first rendered item, e.g. a featured gallery tile. */
  firstClass?: string;
}

export type Binding =
  | TextBinding
  | HtmlBinding
  | AttrBinding
  | StyleBinding
  | ClassBinding
  | ShowBinding
  | ListBinding;

/**
 * Trait name → binding. Keys match `data-trait` / `data-href-trait` values.
 *
 * A list of bindings applies all of them to the same element, in order. One
 * element genuinely needs more than one: a facilitator portrait binds both its
 * `src` and its `alt`, and shipping only `src` is how every published page ended
 * up describing the photo with the template's placeholder name.
 */
export type BindingMap = Record<string, Binding | Binding[]>;

/** A formatter turns resolved context value(s) into a display string. */
export type Formatter = (...values: unknown[]) => string;

export type FormatterMap = Record<string, Formatter>;

export interface ApplyOptions {
  /** Extra/overriding formatters merged over the built-in registry. */
  formatters?: FormatterMap;
  /**
   * Called when a binding names an unknown formatter or an unresolvable path.
   * Defaults to `console.warn`. Pass a collector in tests and in the audit.
   */
  onWarn?: (message: string) => void;
}
