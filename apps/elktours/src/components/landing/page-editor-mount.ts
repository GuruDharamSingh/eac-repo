// Loaded only when an owner opens edit mode, so visitors never download the editor or its stylesheet.
import "@elkdonis/direct-edit/direct-edit.css";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { openPageAsTree } from "@elkdonis/direct-edit/puck";
import { canvasConfig, canvasContract } from "@/lib/puck/config.client";
import { restoreLandingAction, saveLandingAction } from "@/lib/puck/actions";
import { records } from "./person-records";
import { choosePicture } from "./page-picture-chooser";

export async function openLandingEditor({ tree, resolved }: { tree: PuckDoc | null; resolved?: Record<string, Record<string, unknown>> }) {
  const root = document.querySelector<HTMLElement>(".elk-landing");
  if (!root) throw new Error("No landing page here.");
  openPageAsTree({
    root,
    tree,
    title: "Landing page",
    pageName: "Landing page",
    config: canvasConfig as never,
    contract: canvasContract as never,
    records,
    resolved,
    choosePicture,
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
}
