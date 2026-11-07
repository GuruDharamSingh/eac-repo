// Loaded only when an editor opens edit mode, so visitors never download the editor or its stylesheet.
import "@elkdonis/direct-edit/direct-edit.css";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { openVisitorPage } from "@elkdonis/direct-edit/puck";
// By path until @elkdonis/blocks exports it: the package's `exports` has no entry for this file.
import { contractOf } from "../../../../../packages/blocks/src/contract";
import { HOME_BLOCKS } from "@/blocks/home-blocks";
import { choosePicture } from "@/components/studio/page-picture-chooser";
import { landingCanvasConfig } from "@/lib/puck/config.landing";
import { restoreLandingAction, saveLandingAction } from "@/lib/puck/actions";

const FIRST_SAVE = "Saving makes this page public right away. From then on its words no longer follow /manage/pages, and later changes to the page's code do not reach it. \"Restore the original page\" goes back to the code.";

/** A page that snaps and rises as it scrolls moves under a selection box and fights the hand tool. Gone on the reload that closes the editor. */
export function quietThePage() {
  const html = document.documentElement;
  html.style.scrollSnapType = "none";
  html.style.scrollBehavior = "auto";
  const style = document.createElement("style");
  style.textContent = ".pts-panel--line > .pts-wrap { animation: none !important; }";
  document.head.append(style);
}

export async function openLandingEditor({ tree }: { tree: PuckDoc | null }) {
  const root = document.querySelector<HTMLElement>(".pts-snap");
  if (!root) throw new Error("No home page here.");
  await openVisitorPage({
    root,
    selector: ".pts-snap",
    tree,
    title: "Home",
    pageName: "Home page",
    config: landingCanvasConfig as never,
    contract: contractOf(HOME_BLOCKS) as never,
    choosePicture,
    saveNotice: tree ? undefined : FIRST_SAVE,
    onSave: (d) => saveLandingAction(d),
    onDone: () => window.location.reload(),
    ...(tree
      ? {
          async onRestore() {
            const res = await restoreLandingAction();
            if (res.ok) window.location.reload();
          },
        }
      : {}),
  });
  quietThePage();
}
