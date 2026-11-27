"use client";

import type { Config, Plugin } from "@puckeditor/core";
import type { PartsContract } from "@elkdonis/page-builder";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import type { RecordSources } from "@elkdonis/direct-edit/puck";
import type { TreePageOptions } from "@elkdonis/direct-edit/puck";
import { contentDoor } from "./content-door";
import { holdVersion, type HouseSave } from "./save";
import type { RecordFieldHost } from "./fields/FieldsLens";
import { resolvedRows, withProps, type ResolvedKeys } from "./walk";
type PictureChooser = NonNullable<TreePageOptions["choosePicture"]>;

// ============================================================================
// The house canvas, imperatively: direct-edit's canvas on one stored page, with
// Puck one click away (inception), the page's version held for the stale-save
// guard, and a block's settings opened in Puck and drawn again where it sits.
// HouseEditor is the React host of this; apps bind HouseEditor, not this.
// ============================================================================

/** The catalogue an app hands over. `contract` absent: the canvas opens without the look panel or inception. */
export interface HouseConfig {
  /** The published-shape config (buildPuckConfig): what the canvas draws with. */
  canvasConfig: Config;
  /** The editor-shape config (buildEditorConfig): Puck's fields for a block's settings. Absent: a sealed block offers no settings. */
  puckConfig?: Config;
  contract?: PartsContract;
}

/** What a lazy `config` loader may also carry, so an app's picker and record sources load only on opening. */
export interface HouseLoaded extends HouseConfig {
  records?: RecordSources;
  choosePicture?: PictureChooser;
}

export interface HouseFlags {
  /** Shift+click for several, top and left handles, snapping. Default true. */
  designTools?: boolean;
  /** Settings… inside the popup and from a part, each layer over the last. Needs a contract. Default true. */
  inception?: boolean;
  /** The parts plugin (a block.s parts, Edit look) in the settings sheet, when the app has a contract. Default true. */
  sheetParts?: boolean;
  /** The Code tab and Detach. Default false (the site's editors are not developers). */
  developer?: boolean;
  /** Free placement: a Free move tool in the canvas and its popup (x/y offsets stored on the look, drawn from 768px wide up). Default false. */
  freeMove?: boolean;
  /**
   * The Content tab (PLAN 9 step A): a selected block's settings first in the side panel, then Look, written through the checked
   * door (`set_prop`), with the block's rows resolved again after a change; what the panel cannot draw opens the settings sheet.
   * Default false: the panel is as it was.
   */
  contentTab?: boolean;
  /**
   * The zoomed popup over the page, and "Edit look" in the settings sheet that opens it. Default FALSE: everything happens in the one
   * window (a double-click goes one level in, in place). `true` brings the popup back (the canvas's opener and the sheet's).
   */
  largeView?: boolean;
}

export interface HouseRoutes {
  /** Puck's editor on the whole page. Default `/studio/<slug>/blocks`. */
  blocks?: string;
  /** Where Done goes: an address, or a function. */
  done: string | (() => void);
}

export interface HousePages {
  list(): Promise<Array<{ slug: string; title: string; href: string }>>;
  /** Default: the slug being edited. */
  current?: string;
  open?(slug: string): void;
}

export interface HouseOptions {
  host: HTMLElement;
  slug: string;
  orgId: string;
  initial: PuckDoc;
  /** The page's version as loaded (`loadPageWithVersion().updatedAt`). Absent: no guard on the first save. */
  version?: string;
  /** The catalogue, or a loader for it (kept out of a visitor's bundle). */
  config: HouseConfig | (() => Promise<HouseLoaded>);
  /** The app's gated save action. */
  save: HouseSave;
  /** Props each data block's resolver fills (block id -> keys). Absent: nothing is resolved. */
  resolvedKeys?: ResolvedKeys;
  /** Extra metadata for resolvers, beside orgId and slug (a template opened on one record: `{threadId}` / `{piece}`). */
  record?: Record<string, unknown>;
  records?: RecordSources;
  choosePicture?: PictureChooser;
  routes: HouseRoutes;
  /** Takes the editor to an address (`router.push`). Default `location.assign`. */
  navigate?: (href: string) => void;
  /** The page switcher in the name pill. */
  pages?: HousePages;
  /** Said once before the first save, with a way out. */
  saveNotice?: string;
  /** Starting layouts offered in Add. */
  presets?: TreePageOptions["presets"];
  /** Rewrites the stored document before it opens (hidden-enneagram's boxify). */
  prepare?: (doc: PuckDoc) => PuckDoc;
  /** The host's sanitiser for rich text typed in place. */
  cleanRich?: (html: string) => string;
  /** Plugins for the settings sheet beside the parts plugin, made once by the app. */
  sheetPlugins?: Plugin[];
  /** Words that come from a record (a tour's name on its card) open that record's field in the Fields lens's panel, with its own save. Absent: a plain line says they cannot be opened from here. */
  recordFields?: RecordFieldHost;
  flags?: HouseFlags;
  /** Asked before mounting: true when the host went away while the catalogue loaded. */
  cancelled?: () => boolean;
}

/** Opens the editor on `host`. Resolves null when `cancelled()` or the host went away first. */
export async function openHouse(o: HouseOptions): Promise<{ dispose(): void } | null> {
  const { designTools = true, inception = true, developer = false, sheetParts = true, freeMove = false, contentTab = false, largeView = false } = o.flags ?? {};
  const [de, puck, pb, morph, , loaded] = await Promise.all([
    import("@elkdonis/direct-edit/puck"),
    import("@puckeditor/core"),
    import("@elkdonis/page-builder"),
    import("@elkdonis/direct-edit/puck/morph"),
    import("@elkdonis/direct-edit/direct-edit.css" as string),
    typeof o.config === "function" ? o.config() : Promise.resolve(o.config as HouseLoaded),
  ]);
  const { canvasConfig, puckConfig, contract } = loaded;
  const records = o.records ?? loaded.records;
  const choosePicture = o.choosePicture ?? loaded.choosePicture;
  const { mountTreePage, mountLookPanel, openStudioPopup } = de;
  // Style against look: page-builder owns `blkStyle`, direct-edit does not import it, so the panels are handed its reader.
  const blkStyleDecls = (raw: unknown) => { const s = pb.cleanStyle(raw as never); return s ? morph.declsFromStyleObject(pb.styleToCss(s).style) : []; };
  type Options = Parameters<typeof mountTreePage>[0];
  type Components = Record<string, { label?: string }>;
  const components = canvasConfig.components as unknown as Components;
  const keys = o.resolvedKeys ?? {};
  const slug = o.slug;
  const metadata = { orgId: o.orgId, slug, ...(o.record ?? {}) };
  const doc = o.prepare ? o.prepare(o.initial) : o.initial;
  const filled = await puck.resolveAllData(doc as never, canvasConfig, metadata).catch(() => doc);
  if ((o.cancelled && o.cancelled()) || !o.host.isConnected) return null;
  const title = (doc.root as { props?: { title?: unknown } } | undefined)?.props?.title;

  // The Puck sheet's plugins, made once: a block's parts in Puck's right column (the canvas's look panel), and
  // "Edit look" opening direct-edit's popup over the sheet, handed back into it.
  const sheetPlugins: Plugin[] = [
    ...(contract && sheetParts
      ? [
          pb.partsPlugin({
            contract,
            look: { partLookOf: morph.partLookOf, setPartLook: morph.setPartLook, partSafeDecls: morph.partSafeDecls },
            panel: (host: HTMLElement) => mountLookPanel(host, { blkStyleDecls }),
            developer,
            handBack: true,
            ...(largeView ? { popup: (ctx: Parameters<typeof openStudioPopup>[1]) => openStudioPopup({ config: canvasConfig as never, contract: contract as never, records, blkStyleDecls, ...(freeMove ? { freeMove } : {}), ...(contentTab ? { contentTab } : {}) }, ctx) } : {}),
          }),
        ]
      : []),
    ...(o.sheetPlugins ?? []),
  ];

  /** What a data block's resolver draws with these props, where the block sits on the page now. */
  const rowsWith = (id: string, props: Record<string, unknown>) =>
    puck
      .resolveAllData(withProps(editor.doc(), id, props) as never, canvasConfig, metadata)
      .then((d) => resolvedRows(d as PuckDoc, keys)[id] ?? null)
      .catch(() => null);
  const navigate = o.navigate ?? ((href: string) => window.location.assign(href));
  const done = o.routes.done;
  const editor: ReturnType<typeof mountTreePage> = mountTreePage({
    host: o.host,
    config: canvasConfig as unknown as Options["config"],
    contract: contract as unknown as Options["contract"],
    doc,
    resolved: resolvedRows(filled as PuckDoc, keys),
    metadata,
    choosePicture,
    records,
    developer,
    designTools,
    largeView,
    // Words that come from a record open that record's field where they stand, through the lens's own panel and save.
    ...(o.recordFields ? { recordWords: { open: (ref: string) => { void import("./fields/open-record").then((m) => m.openRecordField(o.recordFields!, ref)); } } } : {}),
    ...(freeMove ? { freeMove } : {}),
    ...(contentTab && contract
      ? {
          contentTab,
          // Every change to a setting goes through the one door; rows are resolved again where the block sits.
          setProp: contentDoor(contract),
          resolveRows: (node: { props: Record<string, unknown> & { id: string } }) => rowsWith(node.props.id, node.props),
        }
      : {}),
    blkStyleDecls,
    presets: o.presets,
    cleanRich: o.cleanRich,
    pageName: typeof title === "string" && title.trim() ? title.trim() : `/${slug}`,
    // Puck's editor on the whole page; "Settings…" takes this link's place in the right column.
    blockEditorHref: o.routes.blocks ?? `/studio/${slug}/blocks`,
    pages: o.pages ? { ...o.pages, current: o.pages.current ?? slug } : undefined,
    saveNotice: o.saveNotice,
    onSave: holdVersion(o.save, slug, o.version),
    onDone: () => (typeof done === "function" ? done() : navigate(done)),
    inception: inception && !!contract,
    // Puck on this one block, over the canvas or the popup. Its rows are resolved again where the block sits.
    // Offered only when the app has an editor-shape config to open the block in.
    editSettings: puckConfig ? async (node) => {
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
      if (!props) return null;
      const rows = await rowsWith(node.props.id, props);
      return { props, resolved: rows };
    } : undefined,
  });
  return { dispose: () => editor.dispose() };
}
