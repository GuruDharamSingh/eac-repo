"use client";

import { useMemo } from "react";
import type { Data } from "@puckeditor/core";
import { PuckEditor, partsPlugin, templatesPlugin } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
// The look panel's own sheet (every rule is prefixed de-).
import "@elkdonis/direct-edit/direct-edit.css";
import type { PageTemplate } from "@elkdonis/blocks";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";
import { records } from "@/components/landing/person-records";

/**
 * Click into a block and change the look of its parts (2026-11-06): the parts
 * each block declares, stored as the node's `morph` and drawn by MorphMark,
 * which config.client passes to the editor config. The panel is the canvas's
 * (direct-edit's look panel). `developer` adds the Code tab; it stays false
 * until it can be given to platform admins only. Made once: Puck rebuilds its
 * whole UI when a plugin changes identity.
 *
 * `popup` (2026-11-06): "Edit look" in a block's action bar, or a double-click
 * on the block, opens it alone in the canvas's block popup over Studio, drawn
 * with the published-shape config and the rows Puck already fetched; "Use on
 * this page" hands it back as one undo step. The same `developer` switch keeps
 * the popup's Code tab off.
 */
const PARTS = partsPlugin({
  contract: canvasContract,
  look: { partLookOf, setPartLook, partSafeDecls },
  panel: mountLookPanel,
  developer: false,
  popup: (ctx) => openStudioPopup({ config: canvasConfig, contract: canvasContract, records }, ctx),
});

/**
 * The editor, with this site's catalogue, templates and save action bound to
 * it. The org id comes from the server page rather than from siteConfig: that
 * module carries server-only fallbacks that must not enter a client bundle.
 */
export function PageEditor({
  slug,
  orgId,
  initial,
  templates,
}: {
  slug: string;
  orgId: string;
  initial: Data;
  templates: PageTemplate[];
}) {
  const plugins = useMemo(() => [templatesPlugin(templates), PARTS], [templates]);
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={orgId}
      onPublish={savePageAction}
      plugins={plugins}
      title={slug === "home" ? "Home page" : slug === "event-detail" ? "Event detail template" : slug === "journal-piece" ? "Writing piece template" : `/${slug}`}
    />
  );
}
