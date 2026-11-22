// Loaded only when an owner opens edit mode, so visitors never download the editor or its stylesheet.
import type { PagePatches, PuckDoc } from "@elkdonis/direct-edit/block";
import { openHouseLanding } from "@elkdonis/house-editor";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { restoreLandingAction, savePageAction } from "@/lib/puck/actions";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { LANDING_RESOLVED_KEYS } from "@/lib/puck/landing-resolved";
import { choosePicture } from "./page-picture-chooser";

/** A section rises in when scrolled to. In a stored tree nothing runs that script, so it starts in view. */
const inView = (list: string[]) => (list.includes("reveal") && !list.includes("in-view") ? [...list, "in-view"] : list);

export async function openLandingEditor({ tree, edits, resolved }: { tree: PuckDoc | null; edits: PagePatches; resolved?: Record<string, Record<string, unknown>> }) {
  const root = document.querySelector<HTMLElement>(".marketing-root");
  if (!root) throw new Error("No landing page here.");
  root.querySelectorAll(".reveal").forEach((e) => e.classList.add("in-view"));
  await openHouseLanding({
    root,
    tree,
    edits,
    slug: LANDING_SLUG,
    title: "Landing page",
    classes: inView,
    resolvedKeys: LANDING_RESOLVED_KEYS,
    // The rows the page already read, so a block draws in the editor as it does on the page (not its built-in sample).
    resolved,
    // puckConfig and the contract are what make "Settings..." open Puck on a real block (the offerings and the forum).
    config: { canvasConfig, puckConfig, contract: canvasContract },
    choosePicture,
    save: savePageAction,
    // As before: no design tools. (No version is read for the landing page yet: its first save is unguarded, then each save's version is held.)
    flags: { designTools: false },
    ...(tree ? {
      async onRestore() {
        const res = await restoreLandingAction();
        if (res.ok) window.location.reload();
      },
    } : {}),
  });
}
