// Loaded only when an owner opens edit mode, so visitors never download the editor or its stylesheet.
import "@elkdonis/direct-edit/direct-edit.css";
import type { PagePatches, PuckDoc } from "@elkdonis/direct-edit/block";
import { openPageAsTree } from "@elkdonis/direct-edit/puck";
import { canvasConfig } from "@/lib/puck/config.client";
import { restoreLandingAction, savePageAction } from "@/lib/puck/actions";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { choosePicture } from "./page-picture-chooser";

/** A section rises in when scrolled to. In a stored tree nothing runs that script, so it starts in view. */
const inView = (list: string[]) => (list.includes("reveal") && !list.includes("in-view") ? [...list, "in-view"] : list);

export async function openLandingEditor({ tree, edits }: { tree: PuckDoc | null; edits: PagePatches }) {
  const root = document.querySelector<HTMLElement>(".marketing-root");
  if (!root) throw new Error("No landing page here.");
  root.querySelectorAll(".reveal").forEach((e) => e.classList.add("in-view"));
  openPageAsTree({
    root,
    tree,
    edits,
    title: "Landing page",
    pageName: "Landing page",
    classes: inView,
    config: canvasConfig as never,
    choosePicture,
    onSave: (d) => savePageAction(LANDING_SLUG, d),
    onDone: () => window.location.reload(),
    ...(tree ? {
      async onRestore() {
        const res = await restoreLandingAction();
        if (res.ok) window.location.reload();
      },
    } : {}),
  });
}
