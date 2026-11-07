"use client";

import type { Data } from "@puckeditor/core";
import { PuckEditor, partsPlugin } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
// The look panel's own sheet (every rule is prefixed de-). Editor only: this
// file is reached from /studio, never from a visitor's route.
import "@elkdonis/direct-edit/direct-edit.css";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";

/**
 * The look layer (katie's and sunjay's): click into a block and change the
 * look of the parts it declares, stored as the node's `morph` (one undo
 * history with Puck's own edits) and drawn by MorphMark on the canvas and the
 * published page alike. "Edit look" in a block's action bar, or a double-click,
 * opens it alone in the block popup, drawn with the published-shape config
 * (canvasConfig). `developer: false` keeps the Code tab and Detach off.
 * Module scope: Puck rebuilds its whole UI when a plugin changes identity.
 */
const PARTS = partsPlugin({
  contract: canvasContract,
  look: { partLookOf, setPartLook, partSafeDecls },
  panel: mountLookPanel,
  developer: false,
  popup: (ctx) => openStudioPopup({ config: canvasConfig, contract: canvasContract }, ctx),
});
const PLUGINS = [PARTS];

const TITLES: Record<string, string> = { home: "Home page", enneagram: "The Figure (/enneagram)" };

/** The editor with this site's catalogue and save action bound to it. */
export function PageEditor({ slug, orgId, initial }: { slug: string; orgId: string; initial: Data }) {
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={orgId}
      onPublish={savePageAction}
      plugins={PLUGINS}
      title={TITLES[slug] ?? `/${slug}`}
    />
  );
}
