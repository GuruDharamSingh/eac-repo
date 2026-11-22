// Loaded only when an owner opens edit mode, so visitors never download the editor or its stylesheet.
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { openHouseLanding } from "@elkdonis/house-editor";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { restoreLandingAction, saveLandingAction } from "@/lib/puck/actions";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { RESOLVED_KEYS } from "@/lib/puck/resolved";
import { records } from "./person-records";
import { choosePicture } from "./page-picture-chooser";

/**
 * The landing page's editor: the house landing bind (@elkdonis/house-editor) on this site's catalogue. A sealed block
 * offers "Settings..." (Puck on that block); saves hold the page's version so a second tab cannot overwrite it.
 */
/**
 * What the panel tells the owner about each live part (2026-11-21). These are drawn by the site's code from its tours
 * and guides, so Puck has no block to open on them; the note says so and points at where each can really be changed.
 */
const LIVE_NOTES: Record<string, { text: string; href?: string; linkLabel?: string }> = {
  "tour-cards": { text: "These are the tour cards. Each card is drawn from the tour itself (title, picture, price, next date), so there are no settings here to open.", href: "/manage/tours", linkLabel: "Edit the tours" },
  "hero-title": { text: "This heading is drawn by the site's code, so it has no settings to open. Save the page and reload it: the heading then comes back as a block whose words you can open in Settings." },
  guides: { text: "These are your guides, drawn from their profiles.", href: "/manage/people", linkLabel: "Edit the guides" },
  "hero-actions": { text: "The first button opens About; the second follows the lead tour." },
  "hero-backdrop": { text: "This is the lead tour's film or picture; it changes with that tour." },
};

export async function openLandingEditor({ tree, resolved, version, orgId }: { tree: PuckDoc | null; resolved?: Record<string, Record<string, unknown>>; version?: string; orgId?: string }) {
  const root = document.querySelector<HTMLElement>(".elk-landing");
  if (!root) throw new Error("No landing page here.");
  await openHouseLanding({
    root,
    tree,
    slug: LANDING_SLUG,
    version,
    orgId,
    title: "Landing page",
    config: { canvasConfig, puckConfig, contract: canvasContract },
    resolvedKeys: RESOLVED_KEYS,
    resolved,
    liveNote: (part) => LIVE_NOTES[part] ?? null,
    choosePicture,
    records,
    // The landing page is not drawn with the design tools (as before).
    flags: { designTools: false },
    save: (_slug, data, held) => saveLandingAction(data, held),
    ...(tree
      ? {
          async onRestore() {
            const res = await restoreLandingAction();
            if (res.ok) window.location.reload();
          },
        }
      : {}),
  });
}
