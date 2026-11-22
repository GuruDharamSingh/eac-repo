"use client";

import { useMemo } from "react";
import type { Data, Plugin } from "@puckeditor/core";
import { PuckEditor, partsPlugin, cleanStyle, styleToCss } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook, declsFromStyleObject } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
import type { RecordSources } from "@elkdonis/direct-edit/puck";
// The look panel's and the chooser's own sheet (every rule is prefixed de-).
import "@elkdonis/direct-edit/direct-edit.css";
import type { HouseConfig } from "./open";
import type { HouseSave } from "./save";

// ============================================================================
// Puck's editor on the whole page, with the house plugin set (2026-11-20): the
// parts plugin (a block's parts in Puck's right column, "Edit look" opening
// direct-edit's popup over Puck, handed back), plus the app's own tabs
// (templates, menu, pages). Same stored document and same save as the canvas.
// ============================================================================

// Style against look: page-builder owns `blkStyle`, direct-edit does not import it, so the look panel is handed its reader.
const blkStyleDecls = (raw: unknown) => { const s = cleanStyle(raw as never); return s ? declsFromStyleObject(styleToCss(s).style) : []; };

export interface HouseWholePageProps {
  slug: string;
  orgId: string;
  initial: Data;
  /** The page's version as loaded; held by Puck's editor and replaced by each save's. */
  version?: string;
  /** `puckConfig` is required here (it is what Puck draws); `contract` adds the parts plugin. */
  config: HouseConfig & { puckConfig: NonNullable<HouseConfig["puckConfig"]> };
  save: HouseSave;
  /** For "Edit look" in the popup: the same record sources as the canvas. */
  records?: RecordSources;
  /** The app's own tabs, beside the parts plugin. Keep the array stable between renders: Puck rebuilds its UI when it changes. */
  plugins?: Plugin[];
  /** A template opened on one record, and any other ambient context for resolvers. */
  metadata?: Record<string, unknown>;
  /** The header title. Default: the page's public address. */
  title?: string;
  /** Select the part again when the popup closes. Default true. */
  handBack?: boolean;
  /** The Code tab and Detach. Default false. */
  developer?: boolean;
  /** Free placement in the popup canvas. Default false. */
  freeMove?: boolean;
  /** Puck's editor chrome in a page-builder theme (`PuckEditor` `theme`). Default: Puck's own look. */
  theme?: "studio";
}

export function HouseWholePage({ slug, orgId, initial, version, config, save, records, plugins, metadata, title, handBack = true, developer = false, freeMove = false, theme }: HouseWholePageProps) {
  const { canvasConfig, puckConfig, contract } = config;
  // Made once per mount: Puck rebuilds its whole UI when a plugin changes identity.
  const all = useMemo(
    () => [
      ...(plugins ?? []),
      ...(contract
        ? [
            partsPlugin({
              contract,
              look: { partLookOf, setPartLook, partSafeDecls },
              panel: (host: HTMLElement) => mountLookPanel(host, { blkStyleDecls }),
              developer,
              handBack,
              popup: (ctx) => openStudioPopup({ config: canvasConfig as never, contract: contract as never, records, blkStyleDecls, ...(freeMove ? { freeMove } : {}) }, ctx),
            }),
          ]
        : []),
    ],
    [plugins, contract, canvasConfig, records, developer, handBack, freeMove],
  );
  return <PuckEditor slug={slug} initial={initial} config={puckConfig} orgId={orgId} metadata={metadata} onPublish={save} version={version} plugins={all} title={title ?? `/${slug}`} theme={theme} />;
}
