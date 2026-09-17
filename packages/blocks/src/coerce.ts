// ============================================================================
// Attributes in, typed props out.
//
// Every prop arrives as a string at least once: from a Silex `data-*`
// attribute, from a URL query, from a JSON blob that was edited by hand. The
// component wants a number, a boolean, an array. That conversion has to happen
// in exactly one place, or two consumers end up disagreeing about what
// `limit="3"` means — which is the class of bug the all-strings embed
// catalogue has been carrying (`props: [{name: 'limit', kind: 'string'}]`,
// with every renderer parsing it itself).
// ============================================================================

import type { BlockDef, PropDef } from "./types";

/** What a raw, unparsed prop bag looks like. */
export type RawProps = Record<
  string,
  string | number | boolean | null | undefined | readonly unknown[]
>;

function coerceOne(def: PropDef, raw: unknown): unknown {
  // A slot is rendered content, never a parsed value — there is no string form
  // of "the three cards someone dropped in here". It is supplied directly by
  // whatever is rendering the block, so coercion has nothing to do and must
  // not overwrite it with a default.
  if (def.kind === "slot") return undefined;

  /**
   * Rows ARE a value, unlike a slot — they live in the saved page JSON and
   * reach the component as data. So they are coerced, per declared column, and
   * anything undeclared in a row is dropped exactly as it is at the top level.
   * A row that is not an object at all is dropped rather than rendered as
   * blanks.
   */
  if (def.kind === "rows") {
    // Handled BEFORE the missing-value fallback below, because an empty list of
    // rows is a complete answer: a block whose rows have all been deleted
    // should draw nothing rather than springing back to its sample.
    if (!Array.isArray(raw)) return def.default ?? [];
    const columns = def.fields ?? [];
    return raw
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row) => {
        const out: Record<string, unknown> = {};
        for (const column of columns) {
          const value = coerceOne(column, row[column.name]);
          if (value !== undefined) out[column.name] = value;
        }
        return out;
      });
  }

  // Missing means "use the default" — never means "render nothing". A block
  // with half its settings unset should still draw.
  if (raw === undefined || raw === null || raw === "") return def.default;

  switch (def.kind) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      // An unparseable number falls back rather than reaching the component as
      // NaN, which renders as the literal text "NaN" on the page.
      if (!Number.isFinite(n)) return def.default;
      // A declared range is a guarantee, not a hint for the form control. Page
      // JSON is stored and can be hand-edited, and an image declared as 10-100
      // percent wide must not arrive at the component as 4000.
      let clamped = n;
      if (def.min !== undefined && clamped < def.min) clamped = def.min;
      if (def.max !== undefined && clamped > def.max) clamped = def.max;
      return clamped;
    }

    case "boolean": {
      if (typeof raw === "boolean") return raw;
      const s = String(raw).trim().toLowerCase();
      // A bare attribute (`data-featured=""`) is HTML's way of saying true,
      // but it was already caught as "" above and defaulted. What's left is an
      // explicit value, so only the explicit falses are false.
      return !(s === "false" || s === "0" || s === "off" || s === "no");
    }

    case "list":
      if (Array.isArray(raw)) return raw;
      return String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    case "select": {
      const s = String(raw);
      const allowed = def.options?.some((o) => o.value === s);
      // An unknown option is a typo or a stale saved value. Falling back keeps
      // the page rendering; letting it through would reach a `switch` with no
      // matching branch and usually render nothing at all.
      return allowed ? s : def.default;
    }

    default:
      return String(raw);
  }
}

/**
 * Coerce a raw prop bag against a block's declaration.
 *
 * Props the block does not declare are DROPPED, not passed through. That is
 * the same posture `componentToEmbedMarker` already takes for Silex embeds,
 * and for the same reason: only what the registry declares gets through, so
 * authored content can never smuggle arbitrary attributes into a component.
 */
export function coerceProps(
  def: Pick<BlockDef, "props">,
  raw: RawProps
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of def.props) {
    const value = coerceOne(prop, raw[prop.name]);
    if (value !== undefined) out[prop.name] = value;
  }
  return out;
}

/**
 * Read props off a DOM element's `data-*` attributes.
 *
 * The bridge for the Silex side: a published `<div data-limit="3">` becomes
 * `{ limit: 3 }` for the same block the React side renders from typed props.
 * Takes a plain getter rather than an Element so this stays usable from
 * node-html-parser server-side, where the binding engine already works, as
 * well as from a real DOM.
 */
export function propsFromAttributes(
  def: Pick<BlockDef, "props">,
  getAttribute: (name: string) => string | null | undefined
): Record<string, unknown> {
  const raw: RawProps = {};
  for (const prop of def.props) {
    // Neither has an attribute form: a slot is an area, and a row set is
    // structured data that a `data-*` string cannot hold.
    if (prop.kind === "slot" || prop.kind === "rows") continue;
    // camelCase → kebab, matching how the attribute is authored.
    const attr = `data-${prop.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    raw[prop.name] = getAttribute(attr) ?? undefined;
  }
  return coerceProps(def, raw);
}
