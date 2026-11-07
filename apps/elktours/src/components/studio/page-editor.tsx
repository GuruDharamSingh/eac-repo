"use client";

import type { Data } from "@puckeditor/core";
import { PuckEditor, partsPlugin } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
// The look panel's and the chooser's own sheet (every rule is prefixed de-).
import "@elkdonis/direct-edit/direct-edit.css";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";
import { records } from "@/components/landing/person-records";

/**
 * Puck Studio for this site's pages (2026-11-06), as on Para Theater: click into a block to change the look of its
 * parts; double-click it, or "Edit look" in its action bar, to open it alone in the canvas's block popup, handed
 * back as one undo step. Code tab and Detach stay off (`developer: false`). Made once: Puck rebuilds its whole UI
 * when a plugin changes identity.
 */
const PLUGINS = [
  partsPlugin({
    contract: canvasContract,
    look: { partLookOf, setPartLook, partSafeDecls },
    panel: mountLookPanel,
    developer: false,
    popup: (ctx) => openStudioPopup({ config: canvasConfig, contract: canvasContract, records }, ctx),
  }),
];

export function PageEditor({ slug, orgId, initial }: { slug: string; orgId: string; initial: Data }) {
  return <PuckEditor slug={slug} initial={initial} config={puckConfig} orgId={orgId} onPublish={savePageAction} plugins={PLUGINS} title={`/${slug}`} />;
}
