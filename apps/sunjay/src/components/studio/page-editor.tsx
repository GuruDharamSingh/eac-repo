"use client";

import { useMemo } from "react";
import type { Data } from "@puckeditor/core";
import { menuPlugin, sectionsPlugin, templatesPlugin } from "@elkdonis/page-builder";
import { HouseWholePage } from "@elkdonis/house-editor";
import type { PageTemplate } from "@elkdonis/blocks";
import { canvasConfig, canvasContract, wholePageConfig as puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";
import { SUNJAY_SECTIONS } from "@/lib/puck/sections";
import { loadNavForEditor, saveNavAction } from "@/lib/puck/nav-actions";
import { records } from "@/components/landing/person-records";

// The Menu tab (shared page-builder plugin; actions are this site's gated ones). Module scope: Puck rebuilds its
// whole UI when a plugin changes identity.
const MENU = menuPlugin({ load: loadNavForEditor, save: saveNavAction, memoKey: "sunjay" });
// The Sections tab (add a section between blocks), beside the page templates. Module scope, like MENU.
const SECTIONS = sectionsPlugin(SUNJAY_SECTIONS, { wrapIn: { types: ["pt-band"], slot: "content" } });
const CONFIG = { canvasConfig, puckConfig, contract: canvasContract };

/**
 * Puck's editor on the whole page: the house plugin set (a block's parts, "Edit look" in the popup) plus this
 * site's templates and Menu. The org id comes from the server page rather than from siteConfig: that module
 * carries server-only fallbacks that must not enter a client bundle.
 */
export function PageEditor({
  slug,
  orgId,
  initial,
  version,
  templates,
  metadata,
}: {
  slug: string;
  orgId: string;
  initial: Data;
  version?: string;
  templates: PageTemplate[];
  /** A template opened on one record (`threadId`, `piece`; app/studio/[slug]/record.ts). */
  metadata?: Record<string, unknown>;
}) {
  const plugins = useMemo(() => [templatesPlugin(templates, "Pages"), SECTIONS, MENU], [templates]);
  return (
    <HouseWholePage
      slug={slug}
      orgId={orgId}
      initial={initial}
      version={version}
      config={CONFIG}
      save={savePageAction}
      records={records}
      plugins={plugins}
      theme="studio"
      metadata={metadata}
      title={slug === "home" ? "Home page" : slug === "event-detail" ? "Event detail template" : slug === "journal-piece" ? "Writing piece template" : `/${slug}`}
    />
  );
}
