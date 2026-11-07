"use client";

import type { ReactNode } from "react";
import type { Plugin } from "@puckeditor/core";
import { PartFields } from "./panel";
import { PartPicker } from "./picker";
import { LookActionBar, openBlockPopupFor } from "./popup";
import type { PartsPluginOptions } from "./types";

// ============================================================================
// Parts: the look of a block's inner elements, edited inside Puck's own editor
// (2026-11-06; moved here from packages/direct-edit/harness/frankenstein).
//
// Puck keeps selection of blocks, placement, history, viewports and save. This
// adds a selected PART inside the selected block: a block's declaration names
// its parts as selectors over markup it already draws, and the page's look for
// one block is `props.morph`, written with the host's morph helpers through
// Puck's `replace`, drawn by the host's MorphMark (buildPuckConfig `morph`).
//
// Public Puck API only: `overrides.iframe` (clicks, outlines), `overrides.fields`
// (the part panel), useGetPuck / createUsePuck, dispatch, history.setHistories.
// page-builder does not depend on @elkdonis/direct-edit: the host passes the
// contract and the morph helpers, as it passes MorphMark to buildPuckConfig.
//
//   const parts = partsPlugin({ contract: contractOf(CATALOGUE), look: { partLookOf, setPartLook, partSafeDecls } });
//
// Create it once (module scope or useMemo): Puck rebuilds its whole UI when the
// plugins array or an override changes identity.
// ============================================================================

export function partsPlugin(options: PartsPluginOptions): Plugin {
  // The block popup (popup.tsx), only for a host that passes one: other hosts keep Puck's own action bar.
  const open = options.popup ? (getPuck: Parameters<typeof openBlockPopupFor>[0], id: string) => openBlockPopupFor(getPuck, options, id) : undefined;
  return {
    overrides: {
      iframe: ({ children, document }: { children: ReactNode; document?: Document }) => (
        <PartPicker doc={document} contract={options.contract} rootLabel={options.rootLabel} open={open}>
          {children}
        </PartPicker>
      ),
      fields: ({ children }: { children: ReactNode }) => <PartFields options={options}>{children}</PartFields>,
      ...(options.popup
        ? {
            actionBar: ({ label, children, parentAction }: { label?: string; children: ReactNode; parentAction: ReactNode }) => (
              <LookActionBar label={label} parentAction={parentAction} options={options}>
                {children}
              </LookActionBar>
            ),
          }
        : {}),
    },
  } as Plugin;
}
