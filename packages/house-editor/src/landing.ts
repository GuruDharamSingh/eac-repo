"use client";

import type { TreePageOptions } from "@elkdonis/direct-edit/puck";
import type { PagePatches } from "@elkdonis/direct-edit/block";
import type { PuckDoc, PuckNode } from "@elkdonis/direct-edit/block";
import type { RecordSources } from "@elkdonis/direct-edit/puck";
import type { Plugin } from "@puckeditor/core";
import type { HouseConfig, HouseFlags } from "./open";
import type { RecordFieldHost } from "./fields/FieldsLens";
import { holdVersion, type HouseSave } from "./save";
import { resolvedRows, withProps, type ResolvedKeys } from "./walk";
type PictureChooser = NonNullable<TreePageOptions["choosePicture"]>;

// ============================================================================
// A page drawn by code, opened as a tree with the house defaults and the same
// stale-save guard (openPageAsTree / openVisitorPage underneath). With a
// `puckConfig` a sealed block offers "Settings..." (Puck on that one block, as
// the canvas in open.ts does). A live part (`data-landing-part`) is drawn by
// the site's code, not by a block, so it has no settings to open.
// ============================================================================

export interface HouseLandingOptions {
  /** "tree" adopts the page's DOM (openPageAsTree); "visitor" reads a signed-out copy of it (openVisitorPage). Default "tree". */
  mode?: "tree" | "visitor";
  /** The element that holds the page as its code drew it. */
  root: HTMLElement;
  /** visitor mode: where the page's root is in a visitor's HTML. */
  selector?: string;
  /** The stored tree, or null to make one from what the page drew. */
  tree: PuckDoc | null;
  /** tree mode: style edits made before the page was a tree. */
  edits?: PagePatches;
  /** The landing page's slug and the version it was read at. */
  slug: string;
  version?: string;
  title?: string;
  /** tree mode: classes a script would have changed by now (innergathering's `in-view`). */
  classes?: (list: string[]) => string[];
  config: HouseConfig;
  /** What the app's resolvers fill in, by block type: stripped on save, and the keys a settings sheet leaves out. Absent: none. */
  resolvedKeys?: ResolvedKeys;
  /** What stored blocks' resolvers drew, by node id (the page hands it over so the editor draws them without asking again). */
  resolved?: Record<string, Record<string, unknown>>;
  /** The org, for the settings sheet's resolvers. */
  orgId?: string;
  save: HouseSave;
  choosePicture?: PictureChooser;
  records?: RecordSources;
  saveNotice?: string;
  /** What the panel says about each live part the page keeps (by `data-landing-part` name): what it is and where it can really be changed. */
  liveNote?: TreePageOptions["liveNote"];
  onDone?: () => void;
  onRestore?: () => void;
  /** Words that come from a record (a tour's name on its card) open that record's field in the Fields lens's panel, with its own save. Absent: a plain line says they cannot be opened from here. */
  recordFields?: RecordFieldHost;
  flags?: Pick<HouseFlags, "designTools" | "developer" | "inception" | "sheetParts" | "largeView">;
  /** Buttons the host adds to the edit bar (the Edit button's "Site style") and what they do. */
  barExtras?: TreePageOptions["barExtras"];
  onBarExtra?: TreePageOptions["onBarExtra"];
}

export async function openHouseLanding(o: HouseLandingOptions) {
  const de = await import("@elkdonis/direct-edit/puck");
  await import("@elkdonis/direct-edit/direct-edit.css" as string);
  const { designTools = true, developer = false, inception = true, sheetParts = true, largeView = false } = o.flags ?? {};
  const puckConfig = o.config.puckConfig;
  const contract = o.config.contract;
  // Settings... only where the app has an editor-shape config to open a block in; the extra libraries load only then.
  let handle: { doc(): PuckDoc } | null = null;
  let sheet: Record<string, unknown> = {};
  if (puckConfig) {
    const [puck, pb, morph] = await Promise.all([import("@puckeditor/core"), import("@elkdonis/page-builder"), import("@elkdonis/direct-edit/puck/morph")]);
    const canvasConfig = o.config.canvasConfig;
    const components = canvasConfig.components as unknown as Record<string, { label?: string }>;
    const keys = o.resolvedKeys ?? {};
    const metadata = { orgId: o.orgId, slug: o.slug };
    // Style against look: page-builder owns `blkStyle`, direct-edit does not import it, so the panels are handed its reader.
    const blkStyleDecls = (raw: unknown) => { const st = pb.cleanStyle(raw as never); return st ? morph.declsFromStyleObject(pb.styleToCss(st).style) : []; };
    // The same sheet as the canvas's (open.ts): a block's parts in Puck's right column, and "Edit look" opening direct-edit's popup over it.
    const sheetPlugins: Plugin[] = contract && sheetParts
      ? [pb.partsPlugin({
          contract,
          look: { partLookOf: morph.partLookOf, setPartLook: morph.setPartLook, partSafeDecls: morph.partSafeDecls },
          panel: (host: HTMLElement) => de.mountLookPanel(host, { blkStyleDecls }),
          developer,
          handBack: true,
          ...(largeView ? { popup: (ctx: Parameters<typeof de.openStudioPopup>[1]) => de.openStudioPopup({ config: o.config.canvasConfig as never, contract: contract as never, records: o.records, blkStyleDecls }, ctx) } : {}),
        })]
      : [];
    sheet = {
      blkStyleDecls,
      inception: inception && !!contract,
      // Puck on this one block, over the canvas or the popup. Its rows are resolved again where the block sits.
      editSettings: async (node: PuckNode) => {
        const props = await pb.openBlockSettings({
          config: puckConfig as never,
          node,
          metadata,
          title: `${components[node.type]?.label ?? node.type}: settings`,
          strip: Object.prototype.hasOwnProperty.call(keys, node.type) ? keys[node.type] : undefined,
          plugins: sheetPlugins.length ? sheetPlugins : undefined,
          // Esc cancels while the sheet is on top: Esc walks back down the layers to the canvas.
          escape: inception,
        });
        if (!props || !handle) return null;
        const rows = await puck
          .resolveAllData(withProps(handle.doc(), node.props.id, props) as never, canvasConfig, metadata)
          .then((d) => resolvedRows(d as PuckDoc, keys)[node.props.id] ?? null)
          .catch(() => null);
        return { props, resolved: rows };
      },
    };
  }
  const base = {
    ...sheet,
    resolved: o.resolved,
    config: o.config.canvasConfig as never,
    contract: o.config.contract as never,
    choosePicture: o.choosePicture,
    records: o.records,
    developer,
    designTools,
    largeView,
    ...(o.recordFields ? { recordWords: { open: (ref: string) => { void import("./fields/open-record").then((m) => m.openRecordField(o.recordFields!, ref)); } } } : {}),
    pageName: o.title,
    saveNotice: o.saveNotice,
    liveNote: o.liveNote,
    onSave: holdVersion(o.save, o.slug, o.version),
    onDone: o.onDone ?? (() => window.location.reload()),
    onRestore: o.onRestore,
    barExtras: o.barExtras,
    onBarExtra: o.onBarExtra,
  };
  const opened = await (o.mode === "visitor"
    ? de.openVisitorPage({ ...base, root: o.root, selector: o.selector ?? "main", tree: o.tree, title: o.title })
    : de.openPageAsTree({ ...base, root: o.root, tree: o.tree, edits: o.edits, title: o.title, classes: o.classes }));
  handle = opened;
  return opened;
}
