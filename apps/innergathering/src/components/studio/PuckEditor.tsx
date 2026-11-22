"use client";

import type { Data } from "@puckeditor/core";
import { HouseWholePage } from "@elkdonis/house-editor";
import { siteConfig } from "@/config/site";
import { canvasConfig, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";

// Puck's editor on the whole page, with this site's catalogue and save action bound to it (the house's
// HouseWholePage). No contract here, so no parts plugin. Saves are guarded by the page's version.
const CONFIG = { canvasConfig, puckConfig };

export function PuckEditor({ slug, initial, version }: { slug: string; initial: Data; version?: string }) {
  return <HouseWholePage slug={slug} orgId={siteConfig.orgId} initial={initial} version={version} config={CONFIG} save={savePageAction} title={`/p/${slug}`} />;
}
