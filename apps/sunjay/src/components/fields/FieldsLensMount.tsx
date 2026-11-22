"use client";

import { usePathname, useRouter } from "next/navigation";
import { FieldsLens, type BlockFieldMap } from "@elkdonis/house-editor/fields";
import { fields } from "@/lib/fields";
import { choosePicture } from "@/components/studio/page-picture-chooser";
import { loadFieldsAction, saveFieldsAction } from "@/app/fields/actions";

/** Places that are editors already (the canvas, Manage, the hub): the lens stays out of their way. */
const NOT_HERE = ["/studio", "/manage", "/hub", "/account"];

/** The home page edits as a tree in place: its own "Edit page" button opens the canvas. */
function openLandingCanvas(): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-de-ui]")).find((b) => b.textContent?.trim() === "Edit page");
  if (button) button.click();
  else window.location.assign("/manage/builder");
}

/** The Fields lens on Para Theater's pages. Only editors are ever sent this (see FieldsLensGate). */
export function FieldsLensMount({ blocks }: { blocks?: { map: BlockFieldMap } }) {
  const router = useRouter();
  const path = usePathname() ?? "/";
  if (NOT_HERE.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <FieldsLens
      registry={fields}
      blocks={blocks}
      load={loadFieldsAction}
      save={saveFieldsAction}
      choosePicture={choosePicture}
      // "Edit the look…" is the canvas door: the home page opens its canvas in place; the other pages go to the page list.
      lookHref="/manage/builder"
      onLook={path === "/" ? openLandingCanvas : undefined}
      labels={{ edit: "Edit wording", done: "Done" }}
      onSaved={() => router.refresh()}
    />
  );
}
