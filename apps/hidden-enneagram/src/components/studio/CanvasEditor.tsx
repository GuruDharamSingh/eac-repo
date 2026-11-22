"use client";

import type { PuckDoc, PuckNode } from "@elkdonis/direct-edit/block";
import { HouseEditor } from "@elkdonis/house-editor";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { savePageAction } from "@/lib/puck/actions";
import { canvasConfig } from "@/lib/puck/config.client";
import { BOXED_TYPES, boxifyDoc, boxifyNode, type BoxNode } from "@/lib/puck/boxify";

// The page editor (canvas first, 2026-11-11): the house canvas (@elkdonis/house-editor) bound to this site's
// catalogue, save action and routes. Pages are a tree of boxes, words and pictures; the blocks that draw a record
// or do something sit in it sealed. A sealed block's settings are in the right column; "Settings…" opens that one
// block in Puck over the canvas; Puck on the whole page stays at /studio/<slug>/blocks.
//
// Welcome, Opening, Passage and Glow open as boxes (lib/puck/boxify.ts) and are offered in Add as starting
// layouts, not as sealed blocks. Visitors see no change until Save. Saves are guarded by the page's version.

/** The templates draw many addresses; a save changes all of them. */
const TEMPLATE_NOTICE: Record<string, string> = {
  service: "This page draws every service's page. Saving changes all of them right away.",
  post: "This page draws every article. Saving changes all of them right away.",
  person: "This page draws every person's page. Saving changes all of them right away.",
};

const PUBLIC_PATH: Record<string, string> = { home: "/", service: "/readings", post: "/writing", person: "/about" };

type Components = Record<string, { label?: string; defaultProps?: Record<string, unknown>; permissions?: Record<string, unknown> }>;
const components = canvasConfig.components as unknown as Components;

// Offered in Add as starting layouts, never as sealed blocks.
const PRESETS = [...BOXED_TYPES].map((type) => ({
  id: type,
  label: components[type]?.label ?? type,
  make: () => boxifyNode({ type, props: { ...(components[type]?.defaultProps ?? {}), id: type } } as BoxNode, new Set()) as unknown as PuckNode,
}));

/** The catalogue and picture chooser load on opening: a visitor's page references neither. */
const load = async () => {
  const [{ canvasContract, puckConfig }, { choosePicture }] = await Promise.all([
    import("@/lib/puck/config.client"),
    import("@/components/studio/page-picture-chooser"),
  ]);
  // The four word blocks are added as boxes (presets), never sealed.
  const config = {
    ...canvasConfig,
    components: Object.fromEntries(
      Object.entries(components).map(([type, c]) => [type, BOXED_TYPES.has(type) ? { ...c, permissions: { ...(c.permissions ?? {}), insert: false } } : c]),
    ),
  } as typeof canvasConfig;
  return { canvasConfig: config, puckConfig, contract: canvasContract, choosePicture };
};

export function CanvasEditor({ slug, orgId, initial, version, blockEditorHref, publicPath }: { slug: string; orgId: string; initial: PuckDoc; version?: string; blockEditorHref?: string; publicPath?: string }) {
  return (
    <HouseEditor
      slug={slug}
      orgId={orgId}
      initial={initial}
      version={version}
      config={load}
      save={savePageAction}
      resolvedKeys={RESOLVED_KEYS}
      prepare={(doc) => boxifyDoc(doc as unknown as { content: unknown[] }).doc as unknown as PuckDoc}
      presets={PRESETS}
      saveNotice={Object.prototype.hasOwnProperty.call(TEMPLATE_NOTICE, slug) ? TEMPLATE_NOTICE[slug] : undefined}
      routes={{ blocks: blockEditorHref, done: publicPath ?? PUBLIC_PATH[slug] ?? `/${slug}` }}
      // As before: no inception, and no parts plugin in the settings sheet.
      flags={{ inception: false, sheetParts: false }}
    />
  );
}
