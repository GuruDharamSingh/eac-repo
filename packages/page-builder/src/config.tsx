import { createElement, type ComponentType, type ReactNode } from "react";
import type { Config } from "@puckeditor/core";
import { SHARED_BLOCKS, toDefaultProps, toPuckFields } from "@elkdonis/blocks";
import type { Block, BlockCategory, PropDef, PropKind } from "@elkdonis/blocks";

// ============================================================================
// Our block catalogue, expressed as a Puck config.
//
// SHARED. This was one app's file until a second site wanted an editor, which
// is the moment a copy stops being cheaper than a package: the adapter carries
// a year of hard-won detail — resolvers that must differ between browser and
// server, `memberSafe` reaching Puck's permissions, a root config without
// which the fields panel is empty — and a second copy inherits none of the
// fixes made to the first.
//
// This is the whole adapter, and it is short on purpose. Every block already
// declares its props as DATA — one `PropDef[]` that drives the component's
// TypeScript types, a Silex trait panel and attribute parsing — so the editor
// gets its fields from the same declaration rather than from a second,
// hand-written description that would drift from the first. That drift is a
// thing that has already happened here once: the Silex catalogue declared
// twelve components while the Silex editor offered eight.
//
// Nothing in @elkdonis/blocks imports Puck, and nothing here is a fork. If Puck
// is ever swapped out, this file is what gets rewritten — not the blocks.
// ============================================================================

/**
 * How a slot reaches a block — and why nothing here does anything about it.
 *
 * Puck hands a slot to a component as a FUNCTION that draws the drop zone, and
 * React throws if you pass a function where a child is expected. The obvious
 * home for that fix is right here: call the function, hand the block the
 * element. That was the first version, and it quietly threw away everything a
 * drop zone accepts — `className`, `minEmptyHeight`, `allow` — because an
 * adapter has no idea what a given block wants its regions to be like.
 *
 * So the blocks package renders its regions through its own <Region>, which
 * takes either shape. This file passes props through untouched, and a block
 * that wants its column to fill its track or its empty region to be tall
 * enough to aim at simply says so.
 */

/** Category key → the label Puck shows above that group in the sidebar. */
// Typed over the union, not `string`, so adding a BlockCategory without a
// label is a compile error rather than a block that quietly lands in Puck's
// auto-generated "Other" group.
const CATEGORY_LABELS: Record<BlockCategory, string> = {
  layout: "Layout",
  headers: "Headers",
  content: "Content",
  listings: "Listings",
  actions: "Actions",
};

/**
 * How a data-driven block gets its rows.
 *
 * Injected rather than imported, because the same catalogue has to work in two
 * places that cannot share an implementation: inside the editor it runs in the
 * BROWSER, where there is no database and the only route to data is an HTTP
 * endpoint; on a published page it runs on the SERVER, where going out over
 * HTTP to our own API would be a pointless round trip. One config, two
 * resolver sets — see config.client.ts and config.server.ts.
 */
export interface BlockResolvers {
  [blockId: string]: (
    props: Record<string, unknown>,
    metadata: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

/**
 * A control for `kind: "image"` props, supplied by the caller.
 *
 * Optional, and only the browser-side config passes one: a published page
 * never renders a field panel, so the server config has no reason to pull an
 * editor component into its graph.
 */
/**
 * A control for one prop kind.
 *
 * Returning `null` for a given prop leaves Puck's own field in place, which is
 * how one renderer can claim some props of a kind and not others — a number
 * with a declared range becomes a slider, a number without one stays the
 * built-in box rather than being replaced by a worse hand-rolled copy of it.
 */
export type FieldRender = (
  prop: PropDef
) => ((props: Record<string, unknown>) => React.ReactElement) | null;

export interface PuckConfigOptions {
  /** How data-driven blocks get their rows. See BlockResolvers. */
  resolvers?: BlockResolvers;
  /**
   * The catalogue to offer.
   *
   * Defaults to everything the shared library ships. A site with blocks of its
   * own passes `[...SHARED_BLOCKS, ...myBlocks]` — which is how a supported
   * tier gets bespoke work without forking the shared set.
   */
  blocks?: Block<never>[];
  /**
   * Controls for prop kinds Puck has no field for.
   *
   * Only the browser-side config passes these: a published page renders no
   * field panel, so the server config has no reason to pull an editor
   * component into its graph.
   */
  fields?: Partial<Record<PropKind, FieldRender>>;

  /**
   * Wrap every block's rendered output, for editor-only chrome.
   *
   * This is how direct manipulation reaches the canvas without the block
   * library knowing an editor exists: a block declares `manipulate` and marks
   * an element with `data-drag-target`, and the decorator supplied here draws
   * the handles beside it. Omitted on the published config, where there is
   * nothing to drag.
   */
  decorate?: (block: Block<never>, Component: ComponentType<never>) => ComponentType<never>;
}

export function buildPuckConfig({
  resolvers = {},
  blocks = SHARED_BLOCKS,
  fields: fieldRenders = {},
  decorate,
}: PuckConfigOptions = {}): Config {
  // Typed as Puck's own map rather than Record<string, unknown>, so the
  // compiler actually checks that toPuckFields() produces field shapes Puck
  // accepts. A loose cast here would have made the adapter unverifiable — the
  // exact failure the editor.ts comment warned about when it typed Puck's
  // fields locally, unverified, because the package was not installed.
  const components: Config["components"] = {};
  const grouped: Record<string, string[]> = {};

  for (const block of blocks) {
    const def = block.def;

    // `sample()` deliberately does NOT go in here.
    //
    // An editor copies defaultProps verbatim into the saved document the
    // moment a block is dropped, and the published renderer applies no
    // defaults and runs no resolvers. So sample rows placed here are not a
    // preview — they are written to the database and published as though they
    // were real, with their dates frozen at the moment of the drop. Fetched
    // data belongs to a resolver, which is what `resolveData` below is.
    const defaults = toDefaultProps(def);

    const resolve = resolvers[def.id];

    const fields = toPuckFields(def);

    // Swap a plain control for a real one, where the caller supplied it — an
    // image becomes a media picker, a bounded number becomes a slider.
    //
    // Done HERE rather than in toPuckFields because the block library must not
    // know an editor exists: `toPuckFields` returns data, and this is the only
    // layer allowed to hold a React component from Puck.
    for (const prop of def.props) {
      // A row's COLUMNS deserve the same controls as a top-level prop. A
      // picture wall whose image column is a plain URL box is a picture wall
      // nobody can fill: the whole point of the picker is that an author
      // chooses from what they have rather than knowing an address.
      if (prop.kind === "rows") {
        const field = fields[prop.name] as {
          type: "array";
          arrayFields: Record<string, unknown>;
        };
        for (const column of prop.fields ?? []) {
          const control = fieldRenders[column.kind]?.(column);
          if (control) field.arrayFields[column.name] = { type: "custom", render: control };
        }
        continue;
      }

      const control = fieldRenders[prop.kind]?.(prop);
      if (!control) continue;
      fields[prop.name] = {
        type: "custom",
        render: control,
      } as unknown as (typeof fields)[string];
    }

    components[def.id] = {
      label: def.label,
      fields,
      defaultProps: defaults,
      // `memberSafe` finally reaches the editor. A block an untrusted author
      // may not place is one they cannot drag out of the drawer — the flag has
      // existed in the catalogue since the start and until now changed nothing.
      ...(def.memberSafe ? {} : { permissions: { insert: false, drag: false } }),
      ...(resolve
        ? {
            resolveData: async (
              data: { props: Record<string, unknown> },
              ctx: { metadata?: Record<string, unknown> }
            ) => {
              const props = await resolve(data.props, ctx.metadata ?? {});
              // readOnly tells the editor these props belong to the resolver,
              // so the fields panel locks them instead of offering an author a
              // control whose value is about to be overwritten.
              const readOnly: Record<string, boolean> = {};
              for (const key of Object.keys(props)) readOnly[key] = true;
              return { props, readOnly };
            },
          }
        : {}),
      // Puck types a render function as receiving its own id and context
      // alongside the props. A block knows nothing about either and ignores
      // the extras, so the cast is asserting exactly that: more is passed in
      // than the block reads.
      render: (() => {
        // An interactive block runs in the browser, and the `puck` context an
        // editor passes to every component is full of functions — a drop-zone
        // renderer, a drag ref. A function cannot cross from a server render
        // into a client component, so the published page died with "Functions
        // cannot be passed directly to Client Components" the moment the first
        // form block was placed. The context is of no use to such a block
        // anyway: it has no slots and nothing to draw for the editor.
        const base = def.interactive
          ? function Interactive(props: Record<string, unknown>) {
              const { puck: _editorContext, ...rest } = props;
              return createElement(block.Component as ComponentType<never>, rest as never);
            }
          : (block.Component as ComponentType<never>);

        return (decorate ? decorate(block, base) : base) as unknown as Config["components"][string]["render"];
      })(),
    };

    const category = def.category ?? "content";
    (grouped[category] ??= []).push(def.id);
  }

  const categories: Record<string, { title: string; components: string[] }> = {};
  // Keep a stable order rather than whatever the catalogue happened to be in,
  // so the sidebar does not reshuffle when a block is added. Iterated as typed
  // entries rather than `Object.keys`, which widens to `string` and then
  // cannot index the record it just came from.
  for (const [key, title] of Object.entries(CATEGORY_LABELS) as [BlockCategory, string][]) {
    const ids = grouped[key];
    if (ids?.length) categories[key] = { title, components: ids };
  }

  return {
    components,
    categories,
    // Without a root, the fields panel is EMPTY whenever nothing is selected —
    // clicking the canvas background, the normal "give me page settings"
    // gesture, does nothing at all. Root defaults are also the one kind an
    // editor applies at load rather than only at insert.
    root: {
      fields: { title: { type: "text", label: "Page title" } },
      defaultProps: { title: "" },
      // `children` IS the page's root drop region. Returning anything that
      // does not render it yields a blank page.
      render: ({ children }: { children?: ReactNode }) => children ?? null,
    },
  } as Config;
}

/** What an empty page looks like. Puck will not mount without this shape. */
export const EMPTY_PAGE = { content: [], root: { props: {} } };
