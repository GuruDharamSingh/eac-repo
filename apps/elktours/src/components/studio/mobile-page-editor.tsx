"use client";

import type { Data } from "@puckeditor/core";
import { PuckEditor, partsPlugin } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
import "@elkdonis/direct-edit/direct-edit.css";
import { mobileCanvasConfig, mobileCanvasContract, mobilePuckConfig } from "@/lib/puck/config.mobile.client";
import { saveMobileDocAction } from "@/lib/puck/mobile-actions";
import { PHONE_WIDTH } from "@/lib/puck/mobile-keys";
import { records } from "@/components/landing/person-records";

/**
 * The same Studio editor as page-editor.tsx, for a phone document (G2): the canvas is the one fixed 390px phone
 * frame instead of Puck's phone/tablet/desktop switcher, and Publish writes the m-* key. Made once, as there.
 */
const PLUGINS = [
  partsPlugin({
    contract: mobileCanvasContract,
    look: { partLookOf, setPartLook, partSafeDecls },
    panel: mountLookPanel,
    developer: false,
    popup: (ctx) => openStudioPopup({ config: mobileCanvasConfig, contract: mobileCanvasContract, records }, ctx),
  }),
];

const VIEWPORTS = [{ width: PHONE_WIDTH, height: "auto" as const, label: "Phone" }];

export function MobilePageEditor({ slug, orgId, initial }: { slug: string; orgId: string; initial: Data }) {
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={mobilePuckConfig}
      orgId={orgId}
      onPublish={saveMobileDocAction}
      plugins={PLUGINS}
      viewports={VIEWPORTS}
      title={`Phone layout: ${slug.replace(/^m-/, "")}`}
    />
  );
}
