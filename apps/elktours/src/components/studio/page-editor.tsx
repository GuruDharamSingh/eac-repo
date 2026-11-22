"use client";

import type { Data } from "@puckeditor/core";
import { HouseWholePage } from "@elkdonis/house-editor";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";
import { records } from "@/components/landing/person-records";

const CONFIG = { canvasConfig, puckConfig, contract: canvasContract };

/**
 * Puck Studio for this site's pages (2026-11-06), as on Para Theater, now the house plugin set: click into a block to
 * change the look of its parts; double-click it, or "Edit look" in its action bar, to open it alone in the canvas's
 * block popup, handed back as one undo step. Code tab and Detach stay off. `handBack` stays off here, as it has been.
 */
export function PageEditor({ slug, orgId, initial, version }: { slug: string; orgId: string; initial: Data; version?: string }) {
  return <HouseWholePage slug={slug} orgId={orgId} initial={initial} version={version} config={CONFIG} save={savePageAction} records={records} handBack={false} />;
}
